'use server';

import { prisma } from './prisma';
import { uploadFile, deleteFolder, listFiles, STORAGE_BUCKETS, getPublicUrl, supabaseAdmin } from './supabase';
import JSZip from 'jszip';
import { TAG_PATTERNS } from './lp-tag-utils';
import { requireSystemAdminAuth } from './system-admin-session-server';

// GTMスニペット
const GTM_HEAD_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MSBWVNVB');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_SNIPPET = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MSBWVNVB"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;


// tracking.jsスニペット
const TRACKING_SNIPPET = `<script src="/lp/tracking.js"></script>`;

// フッターリンクスニペット
const FOOTER_LINKS_SNIPPET = `    <nav class="footer-links">
      <a href="https://tastas.work/terms" target="_blank" rel="noopener noreferrer">利用規約</a>
      <a href="https://tastas.work/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
      <a href="https://www.careergift.co.jp" target="_blank" rel="noopener noreferrer">運営会社</a>
    </nav>`;

// フッターリンク検出パターン
const FOOTER_LINKS_PATTERN = /tastas\.work\/terms|tastas\.work\/privacy|careergift\.co\.jp/i;

/**
 * HTMLにタグを自動挿入する
 * 既存のタグがある場合はスキップ
 */
function insertTagsToHtml(html: string, ctaUrl?: string | null): {
  html: string;
  hasGtm: boolean;
  hasTracking: boolean;
} {
  let modifiedHtml = html;

  // 既存タグの検出
  const hasGtm = TAG_PATTERNS.GTM.test(html);
  const hasTracking = TAG_PATTERNS.TRACKING.test(html);

  // GTMタグを挿入（なければ）
  if (!hasGtm) {
    // <head>の直後に挿入
    modifiedHtml = modifiedHtml.replace(/<head([^>]*)>/i, `<head$1>\n${GTM_HEAD_SNIPPET}`);
    // <body>の直後に挿入
    modifiedHtml = modifiedHtml.replace(/<body([^>]*)>/i, `<body$1>\n${GTM_BODY_SNIPPET}`);
  }

  // data-cats="lineFriendsFollowLink" 属性を持つaタグのhrefをCTA URLに置換
  if (ctaUrl) {
    // hrefがdata-catsより後にある場合
    modifiedHtml = modifiedHtml.replace(
      /(<a\s[^>]*data-cats\s*=\s*"lineFriendsFollowLink"[^>]*href\s*=\s*")([^"]*)(")/gi,
      `$1${ctaUrl}$3`
    );
    // hrefがdata-catsより前にある場合
    modifiedHtml = modifiedHtml.replace(
      /(<a\s[^>]*href\s*=\s*")([^"]*)("[^>]*data-cats\s*=\s*"lineFriendsFollowLink")/gi,
      `$1${ctaUrl}$3`
    );
    console.log(`[LP Upload] Replaced data-cats="lineFriendsFollowLink" href with CTA URL: ${ctaUrl}`);
  }

  // tracking.jsを挿入（なければ）
  if (!hasTracking) {
    // </body>の直前に挿入
    modifiedHtml = modifiedHtml.replace(/<\/body>/i, `${TRACKING_SNIPPET}\n</body>`);
  }

  // jobs-widget-loader.jsを挿入（なければ）
  const JOBS_WIDGET_SNIPPET = `<script src="/lp/jobs-widget-loader.js"></script>`;
  const hasJobsWidget = /jobs-widget-loader\.js/i.test(modifiedHtml);
  if (!hasJobsWidget) {
    modifiedHtml = modifiedHtml.replace(/<\/body>/i, `${JOBS_WIDGET_SNIPPET}\n</body>`);
  }

  // フッターリンクを挿入（なければ）
  const hasFooterLinks = FOOTER_LINKS_PATTERN.test(modifiedHtml);
  if (!hasFooterLinks) {
    // <footer> の直後、最初の子要素の前に挿入
    const footerInserted = modifiedHtml.replace(
      /(<footer[^>]*>)\s*\n?/i,
      `$1\n${FOOTER_LINKS_SNIPPET}\n`
    );
    if (footerInserted !== modifiedHtml) {
      modifiedHtml = footerInserted;
      console.log('[LP Upload] Inserted footer links (利用規約・プライバシーポリシー・運営会社)');
    }
  }

  return {
    html: modifiedHtml,
    hasGtm: true, // 挿入後は必ずtrue
    hasTracking: true,
  };
}

/**
 * 相対パスを正規化（先頭の ./ ../ を除去）
 */
function normalizePath(relativePath: string): string {
  return relativePath
    .replace(/^(\.\/)+/, '')    // 先頭の ./ を除去
    .replace(/^(\.\.\/)+/, ''); // 先頭の ../ を除去（LP root より上には行けない）
}

/**
 * HTML内の相対パスをSupabase Storageの絶対URLに変換
 * - src, srcset, href, url() を対象
 * - /始まりの絶対パス（例: /lp/tracking.js）は変換しない
 * - ./ ../ を正規化してからURLを構築
 */
function convertImagePaths(html: string, lpNumber: number, supabaseUrl: string): string {
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lpNumber}`;

  // src属性の相対パス変換（/始まりの絶対パスは除外）
  let modifiedHtml = html.replace(
    /src="(?!http|\/\/|\/|data:)([^"]+)"/gi,
    (_match, path) => `src="${baseUrl}/${normalizePath(path)}"`
  );

  // srcset属性の相対パス変換（カンマ区切りの各エントリを個別に変換）
  modifiedHtml = modifiedHtml.replace(
    /srcset="([^"]+)"/gi,
    (_match, srcsetValue: string) => {
      const converted = srcsetValue.split(',').map((entry: string) => {
        const trimmed = entry.trim();
        const parts = trimmed.split(/\s+/);
        const url = parts[0];
        const descriptor = parts.slice(1).join(' ');
        // 絶対URL・データURL・/始まりはそのまま
        if (/^(https?:|\/\/|\/|data:)/i.test(url)) {
          return trimmed;
        }
        const newUrl = `${baseUrl}/${normalizePath(url)}`;
        return descriptor ? `${newUrl} ${descriptor}` : newUrl;
      }).join(', ');
      return `srcset="${converted}"`;
    }
  );

  // href属性の相対パス変換（CSSファイルなど、/始まりは除外）
  modifiedHtml = modifiedHtml.replace(
    /href="(?!http|\/\/|\/|data:|#|mailto:)([^"]+\.(?:css|ico|png|jpg|jpeg|gif|svg|webp))"/gi,
    (_match, path) => `href="${baseUrl}/${normalizePath(path)}"`
  );

  // CSS内のurl()パス変換（/始まりは除外）
  modifiedHtml = modifiedHtml.replace(
    /url\(['"]?(?!http|\/\/|\/|data:)([^'")]+)['"]?\)/gi,
    (_match, path) => `url('${baseUrl}/${normalizePath(path)}')`
  );

  return modifiedHtml;
}

/**
 * 次のLP番号を取得
 * 削除されたLP番号は再利用しない
 */
async function getNextLpNumber(): Promise<number> {
  const maxLp = await prisma.landingPage.findFirst({
    orderBy: { lp_number: 'desc' },
  });
  return (maxLp?.lp_number ?? -1) + 1;
}

/**
 * LP一覧を取得
 */
export async function getLandingPages() {
  return prisma.landingPage.findMany({
    orderBy: [{ sort_order: 'asc' }, { lp_number: 'asc' }],
  });
}

/**
 * LPを取得（LP番号指定）
 */
export async function getLandingPageByNumber(lpNumber: number) {
  return prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });
}

/**
 * Storageに直接アップロードされたZIPファイルからLPを処理
 * クライアントがPresigned URLでuploads/lp-temp/にZIPをアップロード後、この関数で処理する
 */
export async function processLandingPageZip({
  zipKey,
  name,
  lpNumber: editLpNumber,
}: {
  zipKey: string;
  name: string;
  lpNumber?: number;
}): Promise<{ success: boolean; lpNumber?: number; error?: string; warning?: string }> {
  // システム管理者認証チェック
  try {
    await requireSystemAdminAuth();
  } catch {
    return { success: false, error: 'システム管理者認証が必要です' };
  }

  // zipKeyのバリデーション（パストラバーサル防止）
  if (!zipKey.startsWith('lp-temp/') || !zipKey.endsWith('.zip') || zipKey.includes('..')) {
    return { success: false, error: '無効なファイルパスです' };
  }

  if (!name?.trim()) {
    return { success: false, error: 'LP名を入力してください' };
  }

  try {
    // StorageからZIPをダウンロード
    const { data: zipBlob, error: downloadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.UPLOADS)
      .download(zipKey);

    if (downloadError || !zipBlob) {
      console.error('[LP Process] Failed to download ZIP:', downloadError);
      return { success: false, error: 'ZIPファイルのダウンロードに失敗しました' };
    }

    // ZIPファイルを解析
    const arrayBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // index.htmlを探す
    let indexHtmlPath: string | null = null;
    let rootPrefix = '';

    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && relativePath.endsWith('index.html')) {
        if (!indexHtmlPath || relativePath.split('/').length < indexHtmlPath.split('/').length) {
          indexHtmlPath = relativePath;
          const parts = relativePath.split('/');
          if (parts.length > 1) {
            rootPrefix = parts.slice(0, -1).join('/') + '/';
          }
        }
      }
    });

    if (!indexHtmlPath) {
      return { success: false, error: 'ZIPファイル内にindex.htmlが見つかりません' };
    }

    // LP番号を決定（上書きか新規か）
    let lpNumber: number;
    let isOverwrite = false;

    let ctaUrl: string | null = null;
    if (editLpNumber !== undefined) {
      lpNumber = editLpNumber;
      const existing = await getLandingPageByNumber(lpNumber);
      if (existing) {
        isOverwrite = true;
        ctaUrl = existing.cta_url;
      }
    } else {
      lpNumber = await getNextLpNumber();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    // index.htmlを処理
    const indexHtmlFile = zip.file(indexHtmlPath);
    if (!indexHtmlFile) {
      return { success: false, error: 'index.htmlの読み込みに失敗しました' };
    }

    let indexHtml = await indexHtmlFile.async('string');

    // タグを自動挿入
    const tagResult = insertTagsToHtml(indexHtml, ctaUrl);
    indexHtml = tagResult.html;

    // 画像パスを変換
    indexHtml = convertImagePaths(indexHtml, lpNumber, supabaseUrl);

    // アップロードタスクを遅延実行関数として準備
    const uploadTasks: (() => Promise<any>)[] = [];

    // index.htmlをアップロード
    const indexHtmlBuffer = Buffer.from(indexHtml, 'utf-8');
    uploadTasks.push(() =>
      uploadFile(
        STORAGE_BUCKETS.LP_ASSETS,
        `${lpNumber}/index.html`,
        indexHtmlBuffer,
        'text/html; charset=utf-8'
      )
    );

    // その他のファイルをアップロード
    const fileEntries = Object.entries(zip.files);
    for (const [relativePath, zipEntry] of fileEntries) {
      if (zipEntry.dir) continue;
      if (relativePath === indexHtmlPath) continue;

      let normalizedPath = relativePath;
      if (rootPrefix && relativePath.startsWith(rootPrefix)) {
        normalizedPath = relativePath.slice(rootPrefix.length);
      }

      const content = await zipEntry.async('nodebuffer');
      const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
      const contentType = getContentType(ext);

      uploadTasks.push(() =>
        uploadFile(
          STORAGE_BUCKETS.LP_ASSETS,
          `${lpNumber}/${normalizedPath}`,
          content,
          contentType
        )
      );
    }

    // 全ファイルをアップロード（10ファイルずつバッチ実行）
    const BATCH_SIZE = 10;
    let allResults: any[] = [];
    for (let i = 0; i < uploadTasks.length; i += BATCH_SIZE) {
      const batch = uploadTasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fn => fn()));
      allResults = allResults.concat(batchResults);
    }

    const errors = allResults.filter((r) => 'error' in r);
    const totalFiles = uploadTasks.length;
    const failedFiles = errors.length;

    if (errors.length > 0) {
      console.error('[LP Process] Some files failed to upload:', errors);
    }

    // DBに登録/更新
    if (isOverwrite) {
      await prisma.landingPage.update({
        where: { lp_number: lpNumber },
        data: {
          name: name.trim(),
          has_gtm: tagResult.hasGtm,
          has_tracking: tagResult.hasTracking,
          storage_path: `${lpNumber}/`,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.landingPage.create({
        data: {
          lp_number: lpNumber,
          name: name.trim(),
          has_gtm: tagResult.hasGtm,
          has_tracking: tagResult.hasTracking,
          storage_path: `${lpNumber}/`,
        },
      });
    }

    const warning = failedFiles > 0
      ? `${totalFiles}ファイル中${failedFiles}ファイルのアップロードに失敗しました。LP自体は保存されましたが、一部の画像やアセットが欠けている可能性があります。`
      : undefined;

    return { success: true, lpNumber, warning };
  } catch (error: any) {
    console.error('[LP Process] Error:', error);
    return { success: false, error: error.message || 'アップロードに失敗しました' };
  } finally {
    // 一時ZIPファイルを削除（成功/失敗問わず）
    try {
      await supabaseAdmin.storage.from(STORAGE_BUCKETS.UPLOADS).remove([zipKey]);
      console.log(`[LP Process] Cleaned up temp ZIP: ${zipKey}`);
    } catch (cleanupError) {
      console.error('[LP Process] Failed to cleanup temp ZIP:', cleanupError);
    }
  }
}

/**
 * LPを削除
 */
export async function deleteLandingPage(
  lpNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const lp = await getLandingPageByNumber(lpNumber);
    if (!lp) {
      return { success: false, error: 'LPが見つかりません' };
    }

    // Storage内のファイルを削除
    const folderPath = String(lpNumber);
    const deleteResult = await deleteFolder(STORAGE_BUCKETS.LP_ASSETS, folderPath);

    if (!deleteResult.success) {
      console.error(`[LP Delete] Storage deletion failed for LP ${lpNumber}:`, deleteResult.error);
      // Storageの削除に失敗してもDBは削除を試みる（孤立ファイルは許容）
    } else {
      console.log(`[LP Delete] Deleted ${deleteResult.deletedCount} files from Storage for LP ${lpNumber}`);
    }

    // DBから削除
    await prisma.landingPage.delete({
      where: { lp_number: lpNumber },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[LP Delete] Error:', error);
    return { success: false, error: error.message || '削除に失敗しました' };
  }
}

/**
 * LP名を更新
 */
export async function updateLandingPageName(
  lpNumber: number,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.landingPage.update({
      where: { lp_number: lpNumber },
      data: { name },
    });
    return { success: true };
  } catch (error: any) {
    console.error('[LP Update] Error:', error);
    return { success: false, error: error.message || '更新に失敗しました' };
  }
}

/**
 * LPのCTA URLを更新
 */
export async function updateLandingPageCtaUrl(
  lpNumber: number,
  ctaUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.landingPage.update({
      where: { lp_number: lpNumber },
      data: { cta_url: ctaUrl || null },
    });
    return { success: true };
  } catch (error: any) {
    console.error('[LP CTA URL Update] Error:', error);
    return { success: false, error: error.message || '更新に失敗しました' };
  }
}

/**
 * LP非表示/再表示を切り替え
 */
export async function toggleLpHidden(
  lpNumber: number,
  isHidden: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.landingPage.update({
      where: { lp_number: lpNumber },
      data: { is_hidden: isHidden },
    });
    return { success: true };
  } catch (error: any) {
    console.error('[LP Toggle Hidden] Error:', error);
    return { success: false, error: error.message || '更新に失敗しました' };
  }
}

/**
 * LP表示順序を一括更新
 */
export async function updateLpSortOrders(
  orders: { lpNumber: number; sortOrder: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(
      orders.map(({ lpNumber, sortOrder }) =>
        prisma.landingPage.update({
          where: { lp_number: lpNumber },
          data: { sort_order: sortOrder },
        })
      )
    );
    return { success: true };
  } catch (error: any) {
    console.error('[LP Sort Order] Error:', error);
    return { success: false, error: error.message || '並び替えの保存に失敗しました' };
  }
}

/**
 * LPをコピー（Storageファイル + DB + キャンペーンコード）
 */
export async function copyLandingPage(
  sourceLpNumber: number
): Promise<{ success: boolean; newLpNumber?: number; error?: string }> {
  try {
    // 元LP情報を取得
    const sourceLp = await getLandingPageByNumber(sourceLpNumber);
    if (!sourceLp) {
      return { success: false, error: '元のLPが見つかりません' };
    }

    // 新LP番号を取得
    const newLpNumber = await getNextLpNumber();

    // Storageファイルをコピー
    const { files, error: listError } = await listFiles(STORAGE_BUCKETS.LP_ASSETS, String(sourceLpNumber));
    if (listError) {
      console.error('[LP Copy] Failed to list files:', listError);
    }

    if (files.length > 0) {
      const copyPromises = files.map(async (filePath) => {
        try {
          // ファイルをダウンロード
          const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKETS.LP_ASSETS)
            .download(filePath);
          if (error || !data) {
            console.error(`[LP Copy] Failed to download ${filePath}:`, error);
            return;
          }

          // 新しいパスにアップロード
          const relativePath = filePath.replace(`${sourceLpNumber}/`, '');
          const ext = relativePath.split('.').pop()?.toLowerCase() || '';
          const contentType = getContentType(ext);
          const buffer = Buffer.from(await data.arrayBuffer());

          await uploadFile(
            STORAGE_BUCKETS.LP_ASSETS,
            `${newLpNumber}/${relativePath}`,
            buffer,
            contentType
          );
        } catch (e) {
          console.error(`[LP Copy] Error copying file ${filePath}:`, e);
        }
      });
      await Promise.all(copyPromises);
    }

    // 新しいsort_orderを取得（最大値+1）
    const maxSortOrder = await prisma.landingPage.findFirst({
      orderBy: { sort_order: 'desc' },
    });
    const newSortOrder = (maxSortOrder?.sort_order ?? -1) + 1;

    // DB: 新LPレコード作成
    await prisma.landingPage.create({
      data: {
        lp_number: newLpNumber,
        name: `${sourceLp.name}（コピー）`,
        has_gtm: sourceLp.has_gtm,
        has_line_tag: sourceLp.has_line_tag,
        has_tracking: sourceLp.has_tracking,
        storage_path: `${newLpNumber}/`,
        is_published: true,
        delivery_lp_number: null,
        delivery_utm_source: null,
        cta_url: sourceLp.cta_url,
        sort_order: newSortOrder,
      },
    });

    // キャンペーンコードをコピー
    const sourceCodes = await prisma.lpCampaignCode.findMany({
      where: { lp_id: String(sourceLpNumber), is_active: true },
    });

    for (const code of sourceCodes) {
      // 新しいユニークコードを生成
      const newCode = `${code.code.split('-')[0]}-${Math.random().toString(36).substring(2, 8)}`;
      await prisma.lpCampaignCode.create({
        data: {
          lp_id: String(newLpNumber),
          code: newCode,
          name: code.name,
          genre_id: code.genre_id,
          is_active: true,
        },
      });
    }

    return { success: true, newLpNumber };
  } catch (error: any) {
    console.error('[LP Copy] Error:', error);
    return { success: false, error: error.message || 'コピーに失敗しました' };
  }
}

/**
 * 拡張子からContent-Typeを取得
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return types[ext] || 'application/octet-stream';
}
