/**
 * 既存LP移行スクリプト
 *
 * public/lp/ にあるLPをSupabase Storageに移行し、
 * DBにLandingPageレコードを作成します。
 *
 * 使用方法:
 *   npx tsx scripts/migrate-lp-to-supabase.ts
 *
 * オプション:
 *   --dry-run: 実際には移行せず、対象ファイルを確認のみ
 *   --lp=N: 特定のLP番号のみ移行
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { uploadFile, STORAGE_BUCKETS } from '../lib/supabase';

// タグ検出用の正規表現パターン
const TAG_PATTERNS = {
  GTM: /googletagmanager\.com|GTM-[A-Z0-9]+/i,
  LINE_TAG: /liff\.line\.me|line\.me/i,
  TRACKING: /tracking\.js|\/api\/lp-tracking/i,
};

// Content-Type判定
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

// ディレクトリ内の全ファイルを再帰的に取得
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

// HTML内の相対パスを絶対URLに変換
function convertImagePaths(html: string, lpNumber: number, supabaseUrl: string): string {
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

async function migrateLp(lpNumber: number, dryRun: boolean): Promise<boolean> {
  const lpDir = path.join(process.cwd(), 'public', 'lp', lpNumber.toString());
  const indexPath = path.join(lpDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ❌ LP ${lpNumber}: index.htmlが見つかりません`);
    return false;
  }

  // 既にDBに存在するか確認
  const existing = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });

  if (existing) {
    console.log(`  ⚠️ LP ${lpNumber}: 既にDBに存在します（スキップ）`);
    return false;
  }

  // ファイル一覧を取得
  const files = getAllFiles(lpDir);
  console.log(`  📁 LP ${lpNumber}: ${files.length}ファイルを発見`);

  if (dryRun) {
    console.log(`    ファイル: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // index.htmlを読み込んでタグ検出
  let indexHtml = fs.readFileSync(indexPath, 'utf-8');
  const hasGtm = TAG_PATTERNS.GTM.test(indexHtml);
  const hasLineTag = TAG_PATTERNS.LINE_TAG.test(indexHtml);
  const hasTracking = TAG_PATTERNS.TRACKING.test(indexHtml);

  // 画像パスを変換
  indexHtml = convertImagePaths(indexHtml, lpNumber, supabaseUrl);

  // ファイルをアップロード
  const uploadPromises: Promise<any>[] = [];
  let uploadErrors = 0;

  // index.htmlをアップロード
  const indexBuffer = Buffer.from(indexHtml, 'utf-8');
  uploadPromises.push(
    uploadFile(
      STORAGE_BUCKETS.LP_ASSETS,
      `${lpNumber}/index.html`,
      indexBuffer,
      'text/html; charset=utf-8'
    ).then((result) => {
      if ('error' in result) {
        console.log(`    ❌ index.html: ${result.error}`);
        uploadErrors++;
      }
    })
  );

  // その他のファイルをアップロード
  for (const file of files) {
    if (file === 'index.html') continue;

    const filePath = path.join(lpDir, file);
    const content = fs.readFileSync(filePath);
    const ext = path.extname(file).slice(1).toLowerCase();
    const contentType = getContentType(ext);

    uploadPromises.push(
      uploadFile(
        STORAGE_BUCKETS.LP_ASSETS,
        `${lpNumber}/${file}`,
        content,
        contentType
      ).then((result) => {
        if ('error' in result) {
          console.log(`    ❌ ${file}: ${result.error}`);
          uploadErrors++;
        }
      })
    );
  }

  // 全ファイルをアップロード
  await Promise.all(uploadPromises);

  if (uploadErrors > 0) {
    console.log(`  ⚠️ LP ${lpNumber}: ${uploadErrors}件のアップロードエラー`);
  }

  // lp-config.jsonからLP名を取得
  let lpName = `LP ${lpNumber}`;
  const configPath = path.join(process.cwd(), 'public', 'lp', 'lp-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config[lpNumber.toString()]?.title) {
        lpName = config[lpNumber.toString()].title;
      }
    } catch (e) {
      // 無視
    }
  }

  // DBにレコードを作成
  await prisma.landingPage.create({
    data: {
      lp_number: lpNumber,
      name: lpName,
      has_gtm: hasGtm,
      has_line_tag: hasLineTag,
      has_tracking: hasTracking,
      storage_path: `${lpNumber}/`,
      is_published: true,
    },
  });

  console.log(`  ✅ LP ${lpNumber}: 移行完了`);
  console.log(`    タグ: GTM=${hasGtm ? '○' : '×'}, LINE=${hasLineTag ? '○' : '×'}, Tracking=${hasTracking ? '○' : '×'}`);

  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const lpArg = args.find((a) => a.startsWith('--lp='));
  const specificLp = lpArg ? parseInt(lpArg.split('=')[1], 10) : null;

  console.log('='.repeat(50));
  console.log('LP移行スクリプト');
  console.log('='.repeat(50));
  if (dryRun) {
    console.log('🔍 ドライランモード（実際には移行しません）');
  }
  console.log('');

  const lpDir = path.join(process.cwd(), 'public', 'lp');

  if (!fs.existsSync(lpDir)) {
    console.log('❌ public/lp ディレクトリが見つかりません');
    process.exit(1);
  }

  // LPディレクトリを取得
  const entries = fs.readdirSync(lpDir, { withFileTypes: true });
  const lpNumbers = entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => parseInt(e.name, 10))
    .filter((n) => specificLp === null || n === specificLp)
    .sort((a, b) => a - b);

  if (lpNumbers.length === 0) {
    console.log('対象となるLPがありません');
    process.exit(0);
  }

  console.log(`対象LP: ${lpNumbers.join(', ')}`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;

  for (const lpNumber of lpNumbers) {
    const success = await migrateLp(lpNumber, dryRun);
    if (success) {
      successCount++;
    } else {
      skipCount++;
    }
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`完了: ${successCount}件移行, ${skipCount}件スキップ`);
  if (dryRun) {
    console.log('');
    console.log('実際に移行するには --dry-run を外して実行してください');
  }
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
