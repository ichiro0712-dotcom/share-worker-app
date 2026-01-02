import { test, expect } from '@playwright/test';
import { loginAsWorker } from '../fixtures/auth.fixture';

/**
 * 求人検索ページの安定性テスト
 *
 * 対象デバッグシートID: #67
 * 問題: 仕事を探すページで3回別々の日付をクリックし、最後で待機するとnetlifyのエラーが表示された
 * 原因推測: Netlify/Supabaseのリージョン距離、DB最適化前の不安定性
 * 目的: Vercel移行・DB最適化後の安定性を確認
 */

test.describe('求人検索ページ安定性テスト', () => {
  // コンソールエラーを収集
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];

    // コンソールエラーを監視
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ネットワークエラーを監視
    page.on('requestfailed', (request) => {
      networkErrors.push(`${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
    });

    // ページエラーを監視
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test('日付を連続クリックしてもエラーが発生しない（3回）', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // 日付選択のボタン/リンクを探す
    const dateButtons = page.locator('[data-testid="date-button"], .date-selector button, [data-date], .calendar-day, a[href*="dateIndex"]');
    const dateCount = await dateButtons.count();

    console.log(`Found ${dateCount} date buttons`);

    if (dateCount >= 3) {
      // 3つの異なる日付をクリック
      for (let i = 0; i < 3; i++) {
        const button = dateButtons.nth(i);
        if (await button.isVisible()) {
          console.log(`Clicking date button ${i + 1}`);
          await button.click();
          await page.waitForTimeout(500); // クリック間の短い待機
        }
      }

      // 最後の日付クリック後、ページが安定するまで待機
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // 報告された問題は「待機していると」発生

      // エラーページでないことを確認
      const errorIndicator = page.locator('text=/Error|エラー|500|502|503|504|Netlify/i');
      const hasError = await errorIndicator.isVisible().catch(() => false);

      expect(hasError).toBeFalsy();
      expect(networkErrors.filter(e => e.includes('500') || e.includes('502') || e.includes('503'))).toHaveLength(0);
    }

    // コンソールエラーをログ出力（致命的でないものは許容）
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    }
  });

  test('日付を高速連続クリックしてもクラッシュしない（5回）', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const dateButtons = page.locator('[data-testid="date-button"], .date-selector button, [data-date], .calendar-day, a[href*="dateIndex"]');
    const dateCount = await dateButtons.count();

    if (dateCount >= 5) {
      // 5つの日付を高速でクリック（待機なし）
      for (let i = 0; i < 5; i++) {
        const button = dateButtons.nth(i % dateCount);
        if (await button.isVisible()) {
          await button.click();
          // 待機なしで連続クリック
        }
      }

      // ページが安定するまで待機
      await page.waitForTimeout(5000);
      await page.waitForLoadState('networkidle').catch(() => {});

      // ページがクラッシュしていないことを確認
      const pageContent = await page.content();
      expect(pageContent).toBeTruthy();
      expect(pageContent.length).toBeGreaterThan(100);

      // 致命的なエラーページでないこと
      const errorIndicator = page.locator('text=/Application error|Server error|Netlify|Vercel/i');
      const hasError = await errorIndicator.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();
    }
  });

  test('日付を往復クリックしても安定している（同じ日付を複数回）', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const dateButtons = page.locator('[data-testid="date-button"], .date-selector button, [data-date], .calendar-day, a[href*="dateIndex"]');
    const dateCount = await dateButtons.count();

    if (dateCount >= 2) {
      // 2つの日付を往復でクリック
      for (let round = 0; round < 3; round++) {
        await dateButtons.nth(0).click();
        await page.waitForTimeout(300);
        await dateButtons.nth(1).click();
        await page.waitForTimeout(300);
      }

      await page.waitForLoadState('networkidle');

      // 求人カードまたは「求人がありません」メッセージが表示されること
      const hasContent = await Promise.race([
        page.waitForSelector('.job-card, [data-testid="job-card"], article', { timeout: 10000 }).then(() => true),
        page.waitForSelector('text=/求人が見つかりませんでした|求人がありません/', { timeout: 10000 }).then(() => true),
      ]).catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  });

  test('ページリロードを繰り返しても安定している', async ({ page }) => {
    await loginAsWorker(page);

    const reloadCount = 5;
    const loadTimes: number[] = [];

    for (let i = 0; i < reloadCount; i++) {
      const startTime = Date.now();
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      loadTimes.push(loadTime);

      console.log(`Reload ${i + 1}: ${loadTime}ms`);

      // 毎回コンテンツが表示されることを確認
      const hasContent = await Promise.race([
        page.waitForSelector('.job-card, [data-testid="job-card"], article', { timeout: 10000 }).then(() => true),
        page.waitForSelector('text=/求人が見つかりませんでした|求人がありません/', { timeout: 10000 }).then(() => true),
      ]).catch(() => false);

      expect(hasContent).toBeTruthy();
    }

    // 平均読み込み時間
    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    console.log(`Average load time: ${avgLoadTime}ms`);

    // 平均10秒以内
    expect(avgLoadTime).toBeLessThan(10000);
  });

  test('URLパラメータ付きで複数回アクセスしても安定している', async ({ page }) => {
    await loginAsWorker(page);

    // 異なる日付インデックスでアクセス
    for (let dateIndex = 0; dateIndex < 5; dateIndex++) {
      await page.goto(`/jobs?dateIndex=${dateIndex}`);
      await page.waitForLoadState('networkidle');

      // エラーページでないこと
      const errorIndicator = page.locator('text=/Error|エラー|500|502|503/i');
      const hasError = await errorIndicator.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();

      // 基本的なコンテンツが表示されること
      const mainContent = page.locator('main, [role="main"], .job-list, .jobs-container');
      await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('同時リクエストシミュレーション（並列ナビゲーション）', async ({ page, context }) => {
    await loginAsWorker(page);

    // 複数のページを並列で開く
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    // 各ページで異なる日付にアクセス
    await Promise.all(
      pages.map(async (p, i) => {
        await p.goto(`/jobs?dateIndex=${i}`);
        await p.waitForLoadState('networkidle').catch(() => {});
      })
    );

    // すべてのページがエラーなく表示されること
    for (const p of pages) {
      const errorIndicator = p.locator('text=/Error|エラー|500|502|503/i');
      const hasError = await errorIndicator.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();
      await p.close();
    }
  });

  test('レスポンスタイムの計測', async ({ page }) => {
    await loginAsWorker(page);

    const timings: { action: string; time: number }[] = [];

    // 初回ロード
    let start = Date.now();
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    timings.push({ action: 'Initial load', time: Date.now() - start });

    // 日付クリック後のリロード
    const dateButtons = page.locator('[data-testid="date-button"], .date-selector button, [data-date], .calendar-day, a[href*="dateIndex"]');
    if (await dateButtons.count() > 0) {
      start = Date.now();
      await dateButtons.first().click();
      await page.waitForLoadState('networkidle');
      timings.push({ action: 'Date click 1', time: Date.now() - start });

      if (await dateButtons.count() > 1) {
        start = Date.now();
        await dateButtons.nth(1).click();
        await page.waitForLoadState('networkidle');
        timings.push({ action: 'Date click 2', time: Date.now() - start });
      }
    }

    console.log('Response timings:', timings);

    // すべての操作が15秒以内に完了すること
    for (const timing of timings) {
      expect(timing.time).toBeLessThan(15000);
    }
  });
});

test.describe('エラーハンドリングテスト', () => {
  test('不正なdateIndexでもクラッシュしない', async ({ page }) => {
    await loginAsWorker(page);

    // 不正な値でアクセス
    const invalidIndices = [-1, 999, 'abc', ''];
    for (const index of invalidIndices) {
      await page.goto(`/jobs?dateIndex=${index}`);
      await page.waitForLoadState('networkidle').catch(() => {});

      // ページがクラッシュしていないこと
      const pageContent = await page.content();
      expect(pageContent).toBeTruthy();

      // 致命的なエラーページでないこと
      const fatalError = page.locator('text=/Application error|Server error|Unhandled/i');
      const hasFatalError = await fatalError.isVisible().catch(() => false);
      expect(hasFatalError).toBeFalsy();
    }
  });
});
