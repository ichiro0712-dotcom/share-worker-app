'use server';

import { prisma } from './prisma';
import { uploadFile, deleteFolder, STORAGE_BUCKETS, getPublicUrl } from './supabase';
import JSZip from 'jszip';

// タグ検出用の正規表現パターン
const TAG_PATTERNS = {
  GTM: /googletagmanager\.com|GTM-[A-Z0-9]+/i,
  // LINE Tag自体はGTM経由で設置されるため検知不可
  // 代わりに、友だち登録ボタンのdata-cats属性を検知する（markecats連携用）
  LINE_CATS_ATTRIBUTE: /data-cats=["']lineFriendsFollowLink["']/i,
  TRACKING: /tracking\.js|\/api\/lp-tracking/i,
};

// GTMスニペット
const GTM_HEAD_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WTXNHD5K');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_SNIPPET = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WTXNHD5K"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

// LINE友だち登録ボタン検出用パターン（data-cats属性を自動挿入するため）
// 以下のパターンにマッチするaタグにdata-cats="lineFriendsFollowLink"を自動挿入
const LINE_CTA_PATTERNS = [
  // LINE公式のリンクパターン
  /href=["'][^"']*line\.me[^"']*["']/i,
  /href=["'][^"']*lin\.ee[^"']*["']/i,
  // CSSクラスベースのパターン
  /class=["'][^"']*btn-line[^"']*["']/i,
  /class=["'][^"']*line-btn[^"']*["']/i,
  /class=["'][^"']*line-cta[^"']*["']/i,
  /class=["'][^"']*line-friend[^"']*["']/i,
];

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
 * LINE CTAボタンにdata-cats属性を自動挿入する
 * 既にdata-cats属性がある場合はスキップ
 */
function insertDataCatsAttribute(html: string): { html: string; insertedCount: number } {
  let modifiedHtml = html;
  let insertedCount = 0;

  // aタグを検索して、LINE関連かつdata-catsがないものに属性を追加
  modifiedHtml = modifiedHtml.replace(
    /<a\s([^>]*?)>/gi,
    (match, attributes) => {
      // 既にdata-cats属性がある場合はスキップ
      if (/data-cats=/i.test(attributes)) {
        return match;
      }

      // LINE CTAパターンにマッチするかチェック
      const isLineCta = LINE_CTA_PATTERNS.some((pattern) => pattern.test(match));
      if (isLineCta) {
        insertedCount++;
        return `<a ${attributes} data-cats="lineFriendsFollowLink">`;
      }

      return match;
    }
  );

  return { html: modifiedHtml, insertedCount };
}

/**
 * HTMLにタグを自動挿入する
 * 既存のタグがある場合はスキップ
 */
function insertTagsToHtml(html: string): {
  html: string;
  hasGtm: boolean;
  hasLineTag: boolean;
  hasTracking: boolean;
} {
  let modifiedHtml = html;

  // 既存タグの検出
  const hasGtm = TAG_PATTERNS.GTM.test(html);
  const hasTracking = TAG_PATTERNS.TRACKING.test(html);

  // data-cats属性の検出（LINE Tag検知の代替）
  let hasLineCatsAttribute = TAG_PATTERNS.LINE_CATS_ATTRIBUTE.test(html);

  // GTMタグを挿入（なければ）
  if (!hasGtm) {
    // <head>の直後に挿入
    modifiedHtml = modifiedHtml.replace(/<head([^>]*)>/i, `<head$1>\n${GTM_HEAD_SNIPPET}`);
    // <body>の直後に挿入
    modifiedHtml = modifiedHtml.replace(/<body([^>]*)>/i, `<body$1>\n${GTM_BODY_SNIPPET}`);
  }

  // LINE CTAボタンにdata-cats属性を自動挿入
  // （LINE Tag自体はGTM経由で設置されるため、ここではdata-cats属性のみ挿入）
  if (!hasLineCatsAttribute) {
    const result = insertDataCatsAttribute(modifiedHtml);
    modifiedHtml = result.html;
    if (result.insertedCount > 0) {
      hasLineCatsAttribute = true;
      console.log(`[LP Upload] Inserted data-cats attribute to ${result.insertedCount} LINE CTA button(s)`);
    }
  }

  // tracking.jsを挿入（なければ）
  if (!hasTracking) {
    // </body>の直前に挿入
    modifiedHtml = modifiedHtml.replace(/<\/body>/i, `${TRACKING_SNIPPET}\n</body>`);
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
    hasLineTag: hasLineCatsAttribute, // data-cats属性の有無で判定
    hasTracking: true,
  };
}

/**
 * HTML内の相対画像パスをSupabase Storageの絶対URLに変換
 */
function convertImagePaths(html: string, lpNumber: number, supabaseUrl: string): string {
  // 相対パスの画像を絶対パスに変換
  // 例: src="images/hero.jpg" → src="https://xxx.supabase.co/storage/v1/object/public/lp-assets/0/images/hero.jpg"
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lpNumber}`;

  // src属性の相対パス変換
  let modifiedHtml = html.replace(
    /src="(?!http|\/\/|data:)([^"]+)"/gi,
    `src="${baseUrl}/$1"`
  );

  // href属性の相対パス変換（CSSファイルなど）
  modifiedHtml = modifiedHtml.replace(
    /href="(?!http|\/\/|data:|#|mailto:)([^"]+\.(?:css|ico|png|jpg|jpeg|gif|svg|webp))"/gi,
    `href="${baseUrl}/$1"`
  );

  // CSS内のurl()パス変換
  modifiedHtml = modifiedHtml.replace(
    /url\(['"]?(?!http|\/\/|data:)([^'")]+)['"]?\)/gi,
    `url('${baseUrl}/$1')`
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
    orderBy: { lp_number: 'asc' },
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
 * ZIPファイルからLPをアップロード
 */
export async function uploadLandingPage(
  formData: FormData
): Promise<{ success: boolean; lpNumber?: number; error?: string; warning?: string }> {
  try {
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const lpNumberStr = formData.get('lpNumber') as string | null;

    if (!file) {
      return { success: false, error: 'ファイルが選択されていません' };
    }

    if (!name) {
      return { success: false, error: 'LP名を入力してください' };
    }

    // ファイルサイズ検証（最大50MB）
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: `ファイルサイズが大きすぎます（最大50MB）。現在: ${Math.round(file.size / 1024 / 1024)}MB` };
    }

    // ZIPファイルを解析
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // index.htmlを探す
    let indexHtmlPath: string | null = null;
    let rootPrefix = '';

    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && relativePath.endsWith('index.html')) {
        // 最も浅い階層のindex.htmlを使用
        if (!indexHtmlPath || relativePath.split('/').length < indexHtmlPath.split('/').length) {
          indexHtmlPath = relativePath;
          // ルートプレフィックスを抽出（例: "lp-folder/index.html" → "lp-folder/"）
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

    if (lpNumberStr) {
      lpNumber = parseInt(lpNumberStr, 10);
      const existing = await getLandingPageByNumber(lpNumber);
      if (existing) {
        isOverwrite = true;
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
    const tagResult = insertTagsToHtml(indexHtml);
    indexHtml = tagResult.html;

    // 画像パスを変換
    indexHtml = convertImagePaths(indexHtml, lpNumber, supabaseUrl);

    // ファイルをSupabase Storageにアップロード
    const uploadPromises: Promise<any>[] = [];

    // index.htmlをアップロード
    const indexHtmlBuffer = Buffer.from(indexHtml, 'utf-8');
    uploadPromises.push(
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
      if (relativePath === indexHtmlPath) continue; // index.htmlは既に処理済み

      // ルートプレフィックスを除去してパスを正規化
      let normalizedPath = relativePath;
      if (rootPrefix && relativePath.startsWith(rootPrefix)) {
        normalizedPath = relativePath.slice(rootPrefix.length);
      }

      // ファイルを読み込み
      const content = await zipEntry.async('nodebuffer');

      // Content-Typeを決定
      const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
      const contentType = getContentType(ext);

      uploadPromises.push(
        uploadFile(
          STORAGE_BUCKETS.LP_ASSETS,
          `${lpNumber}/${normalizedPath}`,
          content,
          contentType
        )
      );
    }

    // 全ファイルをアップロード
    const results = await Promise.all(uploadPromises);
    const errors = results.filter((r) => 'error' in r);
    const totalFiles = uploadPromises.length;
    const failedFiles = errors.length;

    if (errors.length > 0) {
      console.error('[LP Upload] Some files failed to upload:', errors);
    }

    // DBに登録/更新
    if (isOverwrite) {
      await prisma.landingPage.update({
        where: { lp_number: lpNumber },
        data: {
          name,
          has_gtm: tagResult.hasGtm,
          has_line_tag: tagResult.hasLineTag,
          has_tracking: tagResult.hasTracking,
          storage_path: `${lpNumber}/`,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.landingPage.create({
        data: {
          lp_number: lpNumber,
          name,
          has_gtm: tagResult.hasGtm,
          has_line_tag: tagResult.hasLineTag,
          has_tracking: tagResult.hasTracking,
          storage_path: `${lpNumber}/`,
        },
      });
    }

    // 一部ファイル失敗時は警告を返す
    const warning = failedFiles > 0
      ? `${totalFiles}ファイル中${failedFiles}ファイルのアップロードに失敗しました。LP自体は保存されましたが、一部の画像やアセットが欠けている可能性があります。`
      : undefined;

    return { success: true, lpNumber, warning };
  } catch (error: any) {
    console.error('[LP Upload] Error:', error);
    return { success: false, error: error.message || 'アップロードに失敗しました' };
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
