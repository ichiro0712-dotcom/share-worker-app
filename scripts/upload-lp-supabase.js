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

function convertImagePaths(html, lpNumber) {
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${lpNumber}`;

  // src属性の相対パス変換
  let mod = html.replace(/src="([^"]+)"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:')) {
      return match;
    }
    return `src="${baseUrl}/${p1}"`;
  });

  // href属性の相対パス変換（CSSなど）
  mod = mod.replace(/href="([^"]+\.(css|ico|png|jpg|jpeg|gif|svg|webp))"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:') || p1.startsWith('#') || p1.startsWith('mailto:')) {
      return match;
    }
    return `href="${baseUrl}/${p1}"`;
  });

  return mod;
}

async function uploadHtml(html, storagePath) {
  const buffer = Buffer.from(html, 'utf-8');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'text/html; charset=utf-8',
      upsert: true
    });
  if (error) {
    console.error('Upload error:', storagePath, error.message);
    return false;
  }
  return true;
}

async function uploadFile(filePath, storagePath, contentType) {
  const content = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, content, {
      contentType,
      upsert: true
    });
  if (error) {
    console.error('Upload error:', storagePath, error.message);
    return false;
  }
  return true;
}

async function uploadLp(lpNumber) {
  const lpDir = path.join(process.cwd(), 'public', 'lp', lpNumber.toString());

  // index.html
  const indexPath = path.join(lpDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf-8');
  indexHtml = convertImagePaths(indexHtml, lpNumber);

  await uploadHtml(indexHtml, `${lpNumber}/index.html`);
  console.log(`✅ ${lpNumber}/index.html`);

  // other files
  const entries = fs.readdirSync(lpDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.name === 'index.html') continue;

    const ext = path.extname(entry.name).slice(1).toLowerCase();
    const types = {
      css: 'text/css; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml'
    };
    const contentType = types[ext] || 'application/octet-stream';

    await uploadFile(path.join(lpDir, entry.name), `${lpNumber}/${entry.name}`, contentType);
    console.log(`✅ ${lpNumber}/${entry.name}`);
  }
}

async function main() {
  await uploadLp(1);
  await uploadLp(2);
  console.log('Done!');
}

main().catch(console.error);
