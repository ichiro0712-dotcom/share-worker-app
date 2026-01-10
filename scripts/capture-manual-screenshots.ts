/**
 * マニュアル用スクリーンショット撮影スクリプト
 *
 * 使い方:
 * npx tsx scripts/capture-manual-screenshots.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const FACILITY_OUTPUT_DIR = path.join(process.cwd(), 'docs/manuals/images/facility');
const WORKER_OUTPUT_DIR = path.join(process.cwd(), 'docs/manuals/images/worker');

// テストアカウント
const TEST_ACCOUNTS = {
  facilityAdmin: {
    email: process.env.TEST_FACILITY_ADMIN_EMAIL || 'admin1@facility.com',
    password: process.env.TEST_FACILITY_ADMIN_PASSWORD || 'password123',
  },
  worker: {
    email: process.env.TEST_WORKER_EMAIL || 'tanaka@example.com',
    password: process.env.TEST_WORKER_PASSWORD || 'password123',
  },
};

// PC画面サイズ（施設管理者用）
const PC_VIEWPORT = { width: 1440, height: 900 };

// モバイル画面サイズ（ワーカー用）
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14相当

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function takeScreenshot(page: Page, name: string, outputDir: string): Promise<string> {
  const filepath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${name}.png`);
  return filepath;
}

async function takeFullPageScreenshot(page: Page, name: string, outputDir: string): Promise<string> {
  const filepath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  ✓ ${name}.png (full page)`);
  return filepath;
}

// ========================================
// 施設管理者画面のスクリーンショット（PC）
// ========================================

async function loginAsFacilityAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', TEST_ACCOUNTS.facilityAdmin.email);
  await page.fill('input[type="password"]', TEST_ACCOUNTS.facilityAdmin.password);
  await page.click('button[type="submit"]');

  await page.waitForURL(url => url.pathname.startsWith('/admin') && !url.pathname.endsWith('/login'), {
    timeout: 15000
  }).catch(() => console.log('Login URL change timeout'));

  await page.waitForLoadState('networkidle');
  await sleep(1000);
}

async function captureFacilityScreenshots(browser: Browser): Promise<void> {
  console.log('\n📸 施設管理者画面のスクリーンショット撮影開始...\n');

  await ensureDir(FACILITY_OUTPUT_DIR);

  const context = await browser.newContext({
    viewport: PC_VIEWPORT,
    locale: 'ja-JP',
  });
  const page = await context.newPage();

  try {
    // 1. ログイン画面
    console.log('1. ログイン画面');
    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await sleep(500);
    await takeScreenshot(page, '01-login', FACILITY_OUTPUT_DIR);

    // ログイン
    await loginAsFacilityAdmin(page);

    // 2. ダッシュボード
    console.log('2. ダッシュボード');
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '02-dashboard', FACILITY_OUTPUT_DIR);

    // 3. 求人一覧
    console.log('3. 求人管理');
    await page.goto(`${BASE_URL}/admin/jobs`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '03-jobs-list', FACILITY_OUTPUT_DIR);

    // 4. 求人作成画面
    console.log('4. 求人作成');
    await page.goto(`${BASE_URL}/admin/jobs/new`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '04-job-create-top', FACILITY_OUTPUT_DIR);
    await takeFullPageScreenshot(page, '04-job-create-full', FACILITY_OUTPUT_DIR);

    // 5. 応募者管理
    console.log('5. 応募管理');
    await page.goto(`${BASE_URL}/admin/applications`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '05-applications', FACILITY_OUTPUT_DIR);

    // 6. ワーカー管理
    console.log('6. ワーカー管理');
    await page.goto(`${BASE_URL}/admin/workers`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '06-workers-list', FACILITY_OUTPUT_DIR);

    // 7. メッセージ
    console.log('7. メッセージ');
    await page.goto(`${BASE_URL}/admin/messages`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '07-messages', FACILITY_OUTPUT_DIR);

    // 8. 施設情報
    console.log('8. 施設情報');
    await page.goto(`${BASE_URL}/admin/facility`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '08-facility-info', FACILITY_OUTPUT_DIR);
    await takeFullPageScreenshot(page, '08-facility-info-full', FACILITY_OUTPUT_DIR);

    // 9. レビュー
    console.log('9. レビュー');
    await page.goto(`${BASE_URL}/admin/reviews`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '09-reviews', FACILITY_OUTPUT_DIR);

    // 10. テンプレート
    console.log('10. テンプレート');
    await page.goto(`${BASE_URL}/admin/templates`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '10-templates', FACILITY_OUTPUT_DIR);

    console.log('\n✅ 施設管理者画面の撮影完了!\n');

  } catch (error) {
    console.error('施設管理者画面の撮影中にエラー:', error);
  } finally {
    await context.close();
  }
}

// ========================================
// ワーカー画面のスクリーンショット（モバイル）
// ========================================

async function loginAsWorker(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', TEST_ACCOUNTS.worker.email);
  await page.fill('input[type="password"]', TEST_ACCOUNTS.worker.password);
  await page.click('button[type="submit"]');

  await page.waitForURL(url => !url.pathname.includes('/login'), {
    timeout: 15000
  }).catch(() => console.log('Login URL change timeout'));

  await page.waitForLoadState('networkidle');
  await sleep(1000);
}

async function captureWorkerScreenshots(browser: Browser): Promise<void> {
  console.log('\n📱 ワーカー画面のスクリーンショット撮影開始...\n');

  await ensureDir(WORKER_OUTPUT_DIR);

  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    locale: 'ja-JP',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    // 1. ログイン画面
    console.log('1. ログイン画面');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await sleep(500);
    await takeScreenshot(page, '01-login', WORKER_OUTPUT_DIR);

    // ログイン
    await loginAsWorker(page);

    // 2. 求人一覧（トップページ）
    console.log('2. 求人一覧');
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '02-job-list', WORKER_OUTPUT_DIR);

    // 3. 求人検索（フィルター）
    console.log('3. 求人検索');
    // フィルターボタンがあればクリック
    const filterButton = page.locator('button:has-text("絞り込み"), button:has-text("フィルター")').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await sleep(500);
      await takeScreenshot(page, '03-job-filter', WORKER_OUTPUT_DIR);
      // 閉じる
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // 4. 求人詳細
    console.log('4. 求人詳細');
    // 最初の求人カードをクリック
    const jobCard = page.locator('[data-testid="job-card"], .job-card, a[href^="/jobs/"]').first();
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForLoadState('networkidle');
      await sleep(1000);
      await takeScreenshot(page, '04-job-detail-top', WORKER_OUTPUT_DIR);
      await takeFullPageScreenshot(page, '04-job-detail-full', WORKER_OUTPUT_DIR);
    }

    // 5. マイジョブ
    console.log('5. マイジョブ');
    await page.goto(`${BASE_URL}/my-jobs`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '05-my-jobs', WORKER_OUTPUT_DIR);

    // 6. メッセージ
    console.log('6. メッセージ');
    await page.goto(`${BASE_URL}/messages`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '06-messages', WORKER_OUTPUT_DIR);

    // 7. マイページ
    console.log('7. マイページ');
    await page.goto(`${BASE_URL}/mypage`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '07-mypage', WORKER_OUTPUT_DIR);
    await takeFullPageScreenshot(page, '07-mypage-full', WORKER_OUTPUT_DIR);

    // 8. プロフィール編集
    console.log('8. プロフィール編集');
    await page.goto(`${BASE_URL}/mypage/profile`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '08-profile-edit', WORKER_OUTPUT_DIR);
    await takeFullPageScreenshot(page, '08-profile-edit-full', WORKER_OUTPUT_DIR);

    // 9. レビュー管理
    console.log('9. レビュー管理');
    await page.goto(`${BASE_URL}/mypage/reviews`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '09-reviews', WORKER_OUTPUT_DIR);

    // 10. お気に入り
    console.log('10. お気に入り');
    await page.goto(`${BASE_URL}/mypage/favorites`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await takeScreenshot(page, '10-favorites', WORKER_OUTPUT_DIR);

    console.log('\n✅ ワーカー画面の撮影完了!\n');

  } catch (error) {
    console.error('ワーカー画面の撮影中にエラー:', error);
  } finally {
    await context.close();
  }
}

// ========================================
// メイン処理
// ========================================

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('📷 マニュアル用スクリーンショット撮影');
  console.log('='.repeat(50));
  console.log(`\nベースURL: ${BASE_URL}`);
  console.log(`施設画像出力先: ${FACILITY_OUTPUT_DIR}`);
  console.log(`ワーカー画像出力先: ${WORKER_OUTPUT_DIR}`);

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    await captureFacilityScreenshots(browser);
    await captureWorkerScreenshots(browser);

    console.log('='.repeat(50));
    console.log('🎉 全てのスクリーンショット撮影が完了しました!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
