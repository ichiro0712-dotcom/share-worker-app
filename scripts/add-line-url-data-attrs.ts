/**
 * LP1, LP2のHTMLにdata-line-url-google/meta属性を追加するスクリプト
 * 実行: npx tsx scripts/add-line-url-data-attrs.ts
 */

const GOOGLE_URL = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd';
const META_URL = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY が必要です');
  process.exit(1);
}

async function updateLP(lpNumber: number) {
  // HTMLを取得
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/lp-assets/${lpNumber}/index.html`;
  const res = await fetch(storageUrl);
  if (!res.ok) {
    console.error(`LP${lpNumber}: HTML取得失敗 (${res.status})`);
    return;
  }
  let html = await res.text();

  // 既にdata-line-url属性がある場合はスキップ
  if (html.includes('data-line-url-google')) {
    console.log(`LP${lpNumber}: 既にdata-line-url属性あり、スキップ`);
    return;
  }

  // href="#" を持つLINEボタンに data-line-url-google と data-line-url-meta を追加
  const replaced = html.replace(
    /(<a\s+)href="#"(\s+class="btn-line-(?:header|cta)")/gi,
    `$1href="#" data-line-url-google="${GOOGLE_URL}" data-line-url-meta="${META_URL}"$2`
  );

  if (replaced === html) {
    console.error(`LP${lpNumber}: 置換対象が見つかりませんでした`);
    return;
  }

  const count = (replaced.match(/data-line-url-google/g) || []).length;
  console.log(`LP${lpNumber}: ${count}箇所にdata-line-url属性を追加`);

  // Supabase Storageにアップロード
  const uploadUrl = `${supabaseUrl}/storage/v1/object/lp-assets/${lpNumber}/index.html`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'text/html; charset=utf-8',
      'x-upsert': 'true',
    },
    body: replaced,
  });

  if (uploadRes.ok) {
    console.log(`LP${lpNumber}: Storage更新成功`);
  } else {
    const err = await uploadRes.text();
    console.error(`LP${lpNumber}: アップロード失敗`, err);
  }
}

async function main() {
  console.log('=== LP HTML data-line-url属性追加 ===');
  console.log(`Google URL: ${GOOGLE_URL}`);
  console.log(`Meta URL: ${META_URL}`);
  console.log('');
  await updateLP(1);
  await updateLP(2);
  console.log('\n完了');
}

main();
