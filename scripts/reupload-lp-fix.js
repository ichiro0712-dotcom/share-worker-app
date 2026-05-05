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

  let mod = html.replace(/src="([^"]+)"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:')) {
      return match;
    }
    return `src="${baseUrl}/${p1}"`;
  });

  mod = mod.replace(/href="([^"]+\.(css|ico|png|jpg|jpeg|gif|svg|webp))"/gi, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:') || p1.startsWith('#') || p1.startsWith('mailto:')) {
      return match;
    }
    return `href="${baseUrl}/${p1}"`;
  });

  return mod;
}

async function deleteFolder(lpNumber) {
  console.log(`Deleting existing files for LP ${lpNumber}...`);

  // List files in the folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(`${lpNumber}/`);

  if (listError) {
    console.log(`No existing files for LP ${lpNumber}`);
    return;
  }

  if (files && files.length > 0) {
    const paths = files.map(f => `${lpNumber}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (deleteError) {
      console.error('Delete error:', deleteError.message);
    } else {
      console.log(`Deleted ${paths.length} files`);
    }
  }
}

async function uploadLp(lpNumber) {
  const lpDir = path.join(process.cwd(), 'public', 'lp', lpNumber.toString());

  // Delete existing files first
  await deleteFolder(lpNumber);

  // index.html
  const indexPath = path.join(lpDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf-8');
  indexHtml = convertImagePaths(indexHtml, lpNumber);

  const buffer = Buffer.from(indexHtml, 'utf-8');
  const { error: htmlError } = await supabase.storage
    .from(BUCKET)
    .upload(`${lpNumber}/index.html`, buffer, {
      contentType: 'text/html; charset=utf-8',
      upsert: true
    });

  if (htmlError) {
    console.error('HTML upload error:', htmlError.message);
    return;
  }
  console.log(`✅ ${lpNumber}/index.html (text/html; charset=utf-8)`);

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
      svg: 'image/svg+xml',
      webp: 'image/webp'
    };
    const contentType = types[ext] || 'application/octet-stream';

    const content = fs.readFileSync(path.join(lpDir, entry.name));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${lpNumber}/${entry.name}`, content, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error(`Upload error for ${entry.name}:`, error.message);
    } else {
      console.log(`✅ ${lpNumber}/${entry.name} (${contentType})`);
    }
  }
}

async function main() {
  console.log('Re-uploading LP 1 and 2 with correct Content-Type...');
  await uploadLp(1);
  await uploadLp(2);
  console.log('Done!');
}

main().catch(console.error);
