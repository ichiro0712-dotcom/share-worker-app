import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { uploadFile, STORAGE_BUCKETS } from '../lib/supabase';
import JSZip from 'jszip';

const TAG_PATTERNS = {
  GTM: /googletagmanager\.com|GTM-[A-Z0-9]+/i,
  LINE_TAG: /liff\.line\.me|line\.me/i,
  TRACKING: /tracking\.js|\/api\/lp-tracking/i,
};

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

function convertImagePaths(html: string, lpNumber: number, supabaseUrl: string): string {
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lpNumber}`;
  let modifiedHtml = html.replace(/src="(?!http|\/\/|data:)([^"]+)"/gi, `src="${baseUrl}/$1"`);
  modifiedHtml = modifiedHtml.replace(/href="(?!http|\/\/|data:|#|mailto:)([^"]+\.(?:css|ico|png|jpg|jpeg|gif|svg|webp))"/gi, `href="${baseUrl}/$1"`);
  modifiedHtml = modifiedHtml.replace(/url\(['"]?(?!http|\/\/|data:)([^'")]+)['"]?\)/gi, `url('${baseUrl}/$1')`);
  return modifiedHtml;
}

async function uploadLp(lpNumber: number, name: string) {
  // 既に存在するか確認
  const existing = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });
  if (existing) {
    console.log(`LP ${lpNumber}: Already exists, skipping`);
    return;
  }

  const lpDir = path.join(process.cwd(), 'public', 'lp', lpNumber.toString());
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL not set');
    return;
  }

  // index.htmlを読み込み
  const indexPath = path.join(lpDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // タグ検出
  const hasGtm = TAG_PATTERNS.GTM.test(indexHtml);
  const hasLineTag = TAG_PATTERNS.LINE_TAG.test(indexHtml);
  const hasTracking = TAG_PATTERNS.TRACKING.test(indexHtml);

  // 画像パス変換
  indexHtml = convertImagePaths(indexHtml, lpNumber, supabaseUrl);

  // ファイル一覧を取得
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

  const files = getAllFiles(lpDir);

  // ファイルアップロード
  const uploadPromises: Promise<any>[] = [];

  // index.html（パス変換済み）
  const indexBuffer = Buffer.from(indexHtml, 'utf-8');
  uploadPromises.push(uploadFile(STORAGE_BUCKETS.LP_ASSETS, `${lpNumber}/index.html`, indexBuffer, 'text/html; charset=utf-8'));

  // その他のファイル
  for (const file of files) {
    if (file === 'index.html') continue;
    const filePath = path.join(lpDir, file);
    const content = fs.readFileSync(filePath);
    const ext = path.extname(file).slice(1).toLowerCase();
    uploadPromises.push(uploadFile(STORAGE_BUCKETS.LP_ASSETS, `${lpNumber}/${file}`, content, getContentType(ext)));
  }

  const results = await Promise.all(uploadPromises);
  const errors = results.filter(r => 'error' in r);
  if (errors.length > 0) {
    console.log(`LP ${lpNumber}: ${errors.length} upload errors`);
  }

  // DB登録
  await prisma.landingPage.create({
    data: {
      lp_number: lpNumber,
      name,
      has_gtm: hasGtm,
      has_line_tag: hasLineTag,
      has_tracking: hasTracking,
      storage_path: `${lpNumber}/`,
      is_published: true,
    },
  });

  console.log(`✅ LP ${lpNumber} uploaded: GTM=${hasGtm}, LINE=${hasLineTag}, Tracking=${hasTracking}`);
}

async function main() {
  // lp-config.jsonからLP名を取得
  const configPath = path.join(process.cwd(), 'public', 'lp', 'lp-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  await uploadLp(1, config['1']?.title || 'LP 1');
  await uploadLp(2, config['2']?.title || 'LP 2');

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
