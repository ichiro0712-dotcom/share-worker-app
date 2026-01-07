/**
 * マニュアル用スクリーンショット撮影テスト
 *
 * 使い方:
 * BASE_URL=https://stg-share-worker.vercel.app npx playwright test tests/e2e/manual-screenshots.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

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

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 施設管理者画面（PC）
// ========================================

test.describe('施設管理者画面スクリーンショット', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(120000); // 2分のタイムアウト

  test('施設管理者画面のスクリーンショットを撮影', async ({ page }) => {
    ensureDir(FACILITY_OUTPUT_DIR);

    // 1. ログイン画面
    console.log('1. ログイン画面');
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await sleep(1500);
    // テストアカウントセクションを非表示にしてスクリーンショット撮影
    await page.evaluate(() => {
      // テスト管理者セクションを含む全ての要素を探して非表示
      document.querySelectorAll('h3, h4, p, span, div').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text === 'テスト管理者でログイン' || text.startsWith('テスト管理者でログイン')) {
          // この要素の親カードを非表示
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (parent.classList.contains('bg-white') || parent.classList.contains('card') ||
                parent.tagName === 'SECTION' || (parent.className && parent.className.includes('rounded'))) {
              parent.style.display = 'none';
              parent.setAttribute('data-hidden-for-screenshot', 'true');
              break;
            }
            parent = parent.parentElement;
          }
        }
      });
      // プレースホルダーのみ残して入力値をクリア
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
      if (emailInput) {
        emailInput.setAttribute('data-original-value', emailInput.value);
        emailInput.value = '';
      }
    });
    await sleep(300);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '01-login.png') });
    // 元に戻す
    await page.evaluate(() => {
      document.querySelectorAll('[data-hidden-for-screenshot="true"]').forEach(el => {
        (el as HTMLElement).style.display = '';
        el.removeAttribute('data-hidden-for-screenshot');
      });
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
      if (emailInput) {
        const originalValue = emailInput.getAttribute('data-original-value');
        if (originalValue) emailInput.value = originalValue;
        emailInput.removeAttribute('data-original-value');
      }
    });

    // ログイン
    await page.fill('input[type="email"]', TEST_ACCOUNTS.facilityAdmin.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.facilityAdmin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname.startsWith('/admin') && !url.pathname.endsWith('/login'), {
      timeout: 15000
    }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);

    // 2. ダッシュボード
    console.log('2. ダッシュボード');
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '02-dashboard.png') });

    // 3. 求人一覧
    console.log('3. 求人管理');
    await page.goto('/admin/jobs');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '03-jobs-list.png') });

    // 4. 求人作成画面
    console.log('4. 求人作成');
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '04-job-create.png') });
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '04-job-create-full.png'), fullPage: true });

    // 5. 応募者管理
    console.log('5. 応募管理');
    await page.goto('/admin/applications');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '05-applications.png') });

    // 6. ワーカー管理
    console.log('6. ワーカー管理');
    await page.goto('/admin/workers');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '06-workers-list.png') });

    // 7. メッセージ一覧
    console.log('7. メッセージ');
    await page.goto('/admin/messages');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '07-messages.png') });

    // 7b. メッセージ詳細（チャット画面）
    console.log('7b. メッセージ詳細');
    // メッセージ一覧から最初のワーカー名をクリック（運営以外）
    const messageItem = page.locator('div:has(> div:has-text("山田")) >> nth=0').or(
      page.locator('div:has(img[alt*="avatar"]) >> nth=0')
    ).or(
      page.locator('.cursor-pointer:has-text("山田")').first()
    );
    // より簡単なセレクター：リスト内の最初のクリック可能なアイテム
    const clickableItem = page.locator('div[class*="cursor-pointer"]').first();
    if (await clickableItem.isVisible().catch(() => false)) {
      await clickableItem.click();
      await page.waitForLoadState('domcontentloaded');
      await sleep(2000);
      await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '07b-message-detail.png') });
    } else {
      // フォールバック：リスト内の最初のdivをクリック
      await page.locator('text=山田 太郎').first().click().catch(() => {});
      await sleep(2000);
      await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '07b-message-detail.png') }).catch(() => {});
    }

    // 8. 施設情報
    console.log('8. 施設情報');
    await page.goto('/admin/facility');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '08-facility-info.png') });
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '08-facility-info-full.png'), fullPage: true });

    // 9. レビュー
    console.log('9. レビュー');
    await page.goto('/admin/reviews');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '09-reviews.png') });

    // 10. テンプレート
    console.log('10. テンプレート');
    await page.goto('/admin/templates');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(FACILITY_OUTPUT_DIR, '10-templates.png') });

    console.log('✅ 施設管理者画面の撮影完了!');
  });
});

// ========================================
// ワーカー画面（モバイル）
// ========================================

test.describe('ワーカー画面スクリーンショット', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test.setTimeout(120000); // 2分のタイムアウト

  test('ワーカー画面のスクリーンショットを撮影', async ({ page }) => {
    ensureDir(WORKER_OUTPUT_DIR);

    // 1. ログイン画面
    console.log('1. ログイン画面');
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await sleep(1500);
    // ログインフォーム部分のみをキャプチャ（テストアカウントセクションを除く）
    await page.screenshot({
      path: path.join(WORKER_OUTPUT_DIR, '01-login.png'),
      clip: { x: 0, y: 0, width: 390, height: 700 }  // 上部のみキャプチャ
    });

    // ログイン
    await page.fill('input[type="email"]', TEST_ACCOUNTS.worker.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.worker.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), {
      timeout: 15000
    }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);

    // 2. 求人一覧（トップページ）
    console.log('2. 求人一覧');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '02-job-list.png') });

    // 3. 求人検索（フィルター）- フィルターがあれば
    console.log('3. 求人検索');
    const filterButton = page.locator('button:has-text("絞り込み"), button:has-text("フィルター")').first();
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
      await sleep(1000);
      await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '03-job-filter.png') });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 4. 求人詳細 - 求人一覧から最初の求人をクリック
    console.log('4. 求人詳細');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await sleep(1500);
    const jobLink = page.locator('a[href^="/jobs/"]').first();
    if (await jobLink.isVisible().catch(() => false)) {
      await jobLink.click();
      await page.waitForLoadState('domcontentloaded');
      await sleep(2000);
      await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '04-job-detail.png') });
      await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '04-job-detail-full.png'), fullPage: true });
    }

    // 5. マイジョブ
    console.log('5. マイジョブ');
    await page.goto('/my-jobs');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '05-my-jobs.png') });

    // 6. メッセージ
    console.log('6. メッセージ');
    await page.goto('/messages');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '06-messages.png') });

    // 7. マイページ
    console.log('7. マイページ');
    await page.goto('/mypage');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '07-mypage.png') });
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '07-mypage-full.png'), fullPage: true });

    // 8. プロフィール編集
    console.log('8. プロフィール編集');
    await page.goto('/mypage/profile');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '08-profile-edit.png') });
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '08-profile-edit-full.png'), fullPage: true });

    // 9. レビュー管理
    console.log('9. レビュー管理');
    await page.goto('/mypage/reviews');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '09-reviews.png') });

    // 10. お気に入り
    console.log('10. お気に入り');
    await page.goto('/mypage/favorites');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(WORKER_OUTPUT_DIR, '10-favorites.png') });

    console.log('✅ ワーカー画面の撮影完了!');
  });
});
