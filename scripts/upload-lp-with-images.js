const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'lp-assets';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const lpBaseDir = path.join(process.cwd(), 'public', 'lp');

function getContentType(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const types = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
  };
  return types[ext] || 'application/octet-stream';
}

// HTMLから参照されているファイルを抽出
function extractReferencedFiles(html) {
  const files = new Set();

  // src属性
  const srcMatches = html.matchAll(/src="([^"]+)"/gi);
  for (const match of srcMatches) {
    const src = match[1];
    if (!src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
      files.add(src);
    }
  }

  // href属性（CSS等）
  const hrefMatches = html.matchAll(/href="([^"]+\.(css|png|jpg|jpeg|gif|svg|webp|ico))"/gi);
  for (const match of hrefMatches) {
    const href = match[1];
    if (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
      files.add(href);
    }
  }

  return Array.from(files);
}

// 相対パスを絶対パスに変換してSupabase URLに置換
function convertPathsToSupabaseUrls(html, lpNumber) {
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${lpNumber}`;

  // ../xxx/file.png → LP内のパスに変換
  // 例: ../images/hero.png → images/hero.png（LP内）
  let modified = html;

  // src属性
  modified = modified.replace(/src="(\.\.\/[^"]+)"/gi, (match, p1) => {
    // ../images/xxx.png → images/xxx.png
    const cleanPath = p1.replace(/^\.\.\//, '');
    return `src="${baseUrl}/${cleanPath}"`;
  });

  modified = modified.replace(/src="(\.\/[^"]+)"/gi, (match, p1) => {
    const cleanPath = p1.replace(/^\.\//, '');
    return `src="${baseUrl}/${cleanPath}"`;
  });

  // 相対パスでhttpから始まらないもの
  modified = modified.replace(/src="([^"\/][^"]*\.(png|jpg|jpeg|gif|svg|webp|css|js))"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:')) {
      return match;
    }
    return `src="${baseUrl}/${p1}"`;
  });

  // href属性（CSS等）
  modified = modified.replace(/href="(\.\.\/[^"]+\.(css|png|jpg|jpeg|gif|svg|webp|ico))"/gi, (match, p1) => {
    const cleanPath = p1.replace(/^\.\.\//, '');
    return `href="${baseUrl}/${cleanPath}"`;
  });

  modified = modified.replace(/href="(\.\/[^"]+\.(css|png|jpg|jpeg|gif|svg|webp|ico))"/gi, (match, p1) => {
    const cleanPath = p1.replace(/^\.\//, '');
    return `href="${baseUrl}/${cleanPath}"`;
  });

  modified = modified.replace(/href="([^"\/][^"]*\.(css|ico))"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('#')) {
      return match;
    }
    return `href="${baseUrl}/${p1}"`;
  });

  return modified;
}

async function uploadFile(localPath, storagePath) {
  const content = fs.readFileSync(localPath);
  const contentType = getContentType(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, content, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error(`  ✗ ${storagePath}: ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${storagePath} (${contentType})`);
  return true;
}

async function uploadLpWithDependencies(lpNumber) {
  console.log(`\n=== Uploading LP ${lpNumber} ===`);

  const lpDir = path.join(lpBaseDir, lpNumber.toString());
  const indexPath = path.join(lpDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error(`  ✗ index.html not found in LP ${lpNumber}`);
    return;
  }

  // HTMLを読み込み
  let html = fs.readFileSync(indexPath, 'utf-8');

  // 参照ファイルを抽出
  const referencedFiles = extractReferencedFiles(html);
  console.log(`  Referenced files: ${referencedFiles.length}`);

  // HTMLパスを変換
  html = convertPathsToSupabaseUrls(html, lpNumber);

  // 1. index.html をアップロード
  const htmlBuffer = Buffer.from(html, 'utf-8');
  const { error: htmlError } = await supabase.storage
    .from(BUCKET)
    .upload(`${lpNumber}/index.html`, htmlBuffer, {
      contentType: 'text/html; charset=utf-8',
      upsert: true
    });

  if (htmlError) {
    console.error(`  ✗ index.html: ${htmlError.message}`);
    return;
  }
  console.log(`  ✓ ${lpNumber}/index.html`);

  // 2. LP内のファイル（styles.css等）
  const entries = fs.readdirSync(lpDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name !== 'index.html') {
      await uploadFile(
        path.join(lpDir, entry.name),
        `${lpNumber}/${entry.name}`
      );
    }
  }

  // 3. 参照されている親ディレクトリのファイル
  for (const ref of referencedFiles) {
    // ../xxx/file.png → public/lp/xxx/file.png
    if (ref.startsWith('../')) {
      const cleanPath = ref.replace(/^\.\.\//, '');
      const localPath = path.join(lpBaseDir, cleanPath);

      if (fs.existsSync(localPath)) {
        await uploadFile(localPath, `${lpNumber}/${cleanPath}`);
      } else {
        console.log(`  ⚠ Not found: ${localPath}`);
      }
    }
  }

  console.log(`  ✓ LP ${lpNumber} complete`);
}

async function main() {
  console.log('Uploading LP 1 and 2 with all dependencies...');
  console.log(`Supabase URL: ${supabaseUrl}`);

  await uploadLpWithDependencies(1);
  await uploadLpWithDependencies(2);

  console.log('\nDone!');
}

main().catch(console.error);
