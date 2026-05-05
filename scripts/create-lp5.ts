/**
 * LP5作成スクリプト
 * LP1のHTMLをベースに、Benefitsセクションの上に「おすすめ求人」セクションを追加
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const LP_NUMBER = 5;
const LP_NAME = 'おすすめ求人テスト (LP1ベース)';
const BUCKET = 'lp-assets';

async function main() {
  // LP1のHTMLをpublic URLから取得
  const lp1Url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/1/index.html`;
  console.log('Fetching LP1 from:', lp1Url);
  const response = await fetch(lp1Url);
  if (!response.ok) {
    console.error('LP1のHTMLを取得できません:', response.status, response.statusText);
    return;
  }

  let html = await response.text();

  // LP番号のメタタグを変更
  html = html.replace(
    /<meta name="lp-number" content="1">/,
    `<meta name="lp-number" content="${LP_NUMBER}">`
  );

  // Benefitsセクションの直前に「おすすめ求人」セクションを挿入
  const recommendedJobsSection = `
    <!-- Recommended Jobs Section (Widget) -->
    <section class="recommended-jobs" aria-labelledby="recommended-jobs-title" style="padding: 60px 16px; background: #ffffff;">
      <header class="section-header" style="text-align: center; margin-bottom: 24px;">
        <span class="section-label" style="display: block; font-size: 14px; color: #E60012; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 8px;">Jobs</span>
        <h2 id="recommended-jobs-title" class="section-title" style="font-size: 24px; font-weight: 900; line-height: 1.4;">
          おすすめ求人
        </h2>
      </header>
      <div data-tastas-jobs></div>
    </section>

`;

  // <!-- Benefits Section --> の直前に挿入
  html = html.replace(
    /(\s*<!-- Benefits Section -->)/,
    `${recommendedJobsSection}$1`
  );

  // jobs-widget-loader.js が入っていなければ追加
  if (!/jobs-widget-loader\.js/i.test(html)) {
    html = html.replace(/<\/body>/i, `<script src="/lp/jobs-widget-loader.js"></script>\n</body>`);
  }

  // Supabase Storage REST APIでアップロード（create-4-lps.tsと同じ方式）
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${LP_NUMBER}/index.html`;
  console.log('Uploading to:', uploadUrl);

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'text/html; charset=utf-8',
      'x-upsert': 'true',
    },
    body: html,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error('HTMLアップロードエラー:', uploadRes.status, err);
    return;
  }

  console.log(`✅ LP${LP_NUMBER}/index.html をStorageにアップロード完了`);

  // DBにレコード作成（既存なら更新）
  await prisma.landingPage.upsert({
    where: { lp_number: LP_NUMBER },
    create: {
      lp_number: LP_NUMBER,
      name: LP_NAME,
      has_gtm: true,
      has_line_tag: true,
      has_tracking: true,
      storage_path: `${LP_NUMBER}/`,
      is_published: true,
      delivery_lp_number: LP_NUMBER,
      delivery_utm_source: null,
    },
    update: {
      name: LP_NAME,
      has_gtm: true,
      has_line_tag: true,
      has_tracking: true,
      is_published: true,
    },
  });

  console.log(`✅ LP${LP_NUMBER}のDBレコード作成完了`);
  console.log(`\n🔗 確認URL: http://localhost:3000/lp/${LP_NUMBER}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
