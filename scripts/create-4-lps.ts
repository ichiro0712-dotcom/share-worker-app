/**
 * LP1〜4を作成するスクリプト
 *
 * LP1 = 元LP1 + google用LINE URL直書き → 配信URL: /api/lp/1?utm_source=google
 * LP2 = 元LP1 + meta用LINE URL直書き → 配信URL: /api/lp/1?utm_source=meta
 * LP3 = 元LP2 + google用LINE URL直書き → 配信URL: /api/lp/2?utm_source=google
 * LP4 = 元LP2 + meta用LINE URL直書き → 配信URL: /api/lp/2?utm_source=meta
 *
 * 実行: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/create-4-lps.ts
 */

const GOOGLE_URL = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd';
const META_URL = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY が必要です');
  process.exit(1);
}

// LP定義
const LP_DEFINITIONS = [
  { newLpNumber: 1, sourceLpNumber: 1, utmSource: 'google', lineUrl: GOOGLE_URL, name: 'LP1 (Google広告)', deliveryLpNumber: 1, deliveryUtmSource: 'google' },
  { newLpNumber: 2, sourceLpNumber: 1, utmSource: 'meta',   lineUrl: META_URL,   name: 'LP2 (Meta広告)', deliveryLpNumber: 1, deliveryUtmSource: 'meta' },
  { newLpNumber: 3, sourceLpNumber: 2, utmSource: 'google', lineUrl: GOOGLE_URL, name: 'LP3 (Google広告)', deliveryLpNumber: 2, deliveryUtmSource: 'google' },
  { newLpNumber: 4, sourceLpNumber: 2, utmSource: 'meta',   lineUrl: META_URL,   name: 'LP4 (Meta広告)', deliveryLpNumber: 2, deliveryUtmSource: 'meta' },
];

/**
 * HTMLの href="#" (LINE CTA) を指定URLに直書き置換
 */
function replaceLineUrls(html: string, lineUrl: string): string {
  let modified = html;

  // href="#" を持つLINEボタン（data-cats属性付き）のhrefを置換
  modified = modified.replace(
    /(<a\s[^>]*?)href="#"([^>]*?data-cats="lineFriendsFollowLink")/gi,
    `$1href="${lineUrl}"$2`
  );
  // 逆順（data-catsが先にある場合）も対応
  modified = modified.replace(
    /(<a\s[^>]*?data-cats="lineFriendsFollowLink"[^>]*?)href="#"/gi,
    `$1href="${lineUrl}"`
  );

  return modified;
}

/**
 * data-line-url-* 属性を削除（不要になるため）
 */
function removeDataLineUrlAttrs(html: string): string {
  return html.replace(/\s*data-line-url-[a-z0-9_-]+="[^"]*"/gi, '');
}

async function fetchHtml(lpNumber: number): Promise<string | null> {
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/lp-assets/${lpNumber}/index.html`;
  const res = await fetch(storageUrl);
  if (!res.ok) {
    console.error(`LP${lpNumber}: HTML取得失敗 (${res.status})`);
    return null;
  }
  return res.text();
}

async function uploadHtml(lpNumber: number, html: string): Promise<boolean> {
  const uploadUrl = `${supabaseUrl}/storage/v1/object/lp-assets/${lpNumber}/index.html`;
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'text/html; charset=utf-8',
      'x-upsert': 'true',
    },
    body: html,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`LP${lpNumber}: アップロード失敗`, err);
    return false;
  }
  return true;
}

/**
 * Storage内の全ファイルをコピー（画像等のアセット）
 */
async function copyStorageAssets(sourceLpNumber: number, targetLpNumber: number): Promise<void> {
  if (sourceLpNumber === targetLpNumber) return; // 同じなら不要

  // リスト取得
  const listUrl = `${supabaseUrl}/storage/v1/object/list/lp-assets`;
  const listRes = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: `${sourceLpNumber}/`, limit: 1000 }),
  });

  if (!listRes.ok) {
    console.error(`  アセットリスト取得失敗: ${listRes.status}`);
    return;
  }

  const files = await listRes.json();
  let copied = 0;

  for (const file of files) {
    if (file.name === 'index.html') continue; // HTMLは別途処理
    if (file.name === '.emptyFolderPlaceholder') continue;

    // ファイルを取得
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/lp-assets/${sourceLpNumber}/${file.name}`;
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) continue;

    const content = await fileRes.arrayBuffer();

    // コピー先にアップロード
    const destUrl = `${supabaseUrl}/storage/v1/object/lp-assets/${targetLpNumber}/${file.name}`;
    const uploadRes = await fetch(destUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': file.metadata?.mimetype || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: Buffer.from(content),
    });

    if (uploadRes.ok) {
      copied++;
    }
  }

  console.log(`  アセット ${copied} ファイルをLP${sourceLpNumber}→LP${targetLpNumber}にコピー`);
}

async function main() {
  console.log('=== LP1〜4 作成スクリプト ===\n');

  // 元のHTML取得（LP1, LP2）
  console.log('元HTMLを取得中...');
  const sourceHtmls: Record<number, string> = {};
  for (const sourceLp of [1, 2]) {
    const html = await fetchHtml(sourceLp);
    if (!html) {
      console.error(`元LP${sourceLp}のHTMLが取得できません。中断します。`);
      process.exit(1);
    }
    sourceHtmls[sourceLp] = html;
    console.log(`  LP${sourceLp}: ${html.length} bytes`);
  }

  // 各LP作成
  for (const def of LP_DEFINITIONS) {
    console.log(`\n--- LP${def.newLpNumber}: ${def.name} ---`);
    console.log(`  配信URL: /api/lp/${def.deliveryLpNumber}?utm_source=${def.deliveryUtmSource}`);

    // HTMLを加工
    let html = sourceHtmls[def.sourceLpNumber];

    // data-line-url-* 属性を削除
    html = removeDataLineUrlAttrs(html);

    // LINE URLを直書き
    html = replaceLineUrls(html, def.lineUrl);

    // 画像パスの変換（元LPと違うLP番号の場合）
    if (def.newLpNumber !== def.sourceLpNumber) {
      // Storage内の画像パスを新LP番号に変換
      const oldBase = `${supabaseUrl}/storage/v1/object/public/lp-assets/${def.sourceLpNumber}/`;
      const newBase = `${supabaseUrl}/storage/v1/object/public/lp-assets/${def.newLpNumber}/`;
      html = html.split(oldBase).join(newBase);
    }

    // LINE URL直書きの確認
    const lineUrlCount = (html.match(new RegExp(def.lineUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`  LINE URL直書き: ${lineUrlCount}箇所`);

    // Storageにアップロード
    const uploaded = await uploadHtml(def.newLpNumber, html);
    if (uploaded) {
      console.log(`  HTML: Storage保存成功`);
    } else {
      console.error(`  HTML: Storage保存失敗`);
      continue;
    }

    // アセットコピー（LP3, LP4用）
    if (def.newLpNumber !== def.sourceLpNumber) {
      await copyStorageAssets(def.sourceLpNumber, def.newLpNumber);
    }
  }

  // DB更新
  console.log('\n--- DB更新 ---');

  // Prismaの代わりに直接SQLを使う（スクリプトからPrismaを使うのは複雑なため）
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    for (const def of LP_DEFINITIONS) {
      const existing = await prisma.landingPage.findUnique({
        where: { lp_number: def.newLpNumber },
      });

      if (existing) {
        // 既存LP更新
        await prisma.landingPage.update({
          where: { lp_number: def.newLpNumber },
          data: {
            name: def.name,
            delivery_lp_number: def.deliveryLpNumber,
            delivery_utm_source: def.deliveryUtmSource,
            storage_path: `${def.newLpNumber}/`,
          },
        });
        console.log(`LP${def.newLpNumber}: DB更新（既存）`);
      } else {
        // 新規LP作成
        await prisma.landingPage.create({
          data: {
            lp_number: def.newLpNumber,
            name: def.name,
            has_gtm: true,
            has_line_tag: true,
            has_tracking: true,
            storage_path: `${def.newLpNumber}/`,
            delivery_lp_number: def.deliveryLpNumber,
            delivery_utm_source: def.deliveryUtmSource,
          },
        });
        console.log(`LP${def.newLpNumber}: DB新規作成`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=== 完了 ===');
  console.log('配信URL:');
  for (const def of LP_DEFINITIONS) {
    console.log(`  LP${def.newLpNumber}: /api/lp/${def.deliveryLpNumber}?utm_source=${def.deliveryUtmSource}`);
  }
}

main().catch(console.error);
