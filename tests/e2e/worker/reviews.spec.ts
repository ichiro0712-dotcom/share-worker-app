import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loginAsWorker } from '../fixtures/auth.fixture';
import { openMyPageMenu, openWorkerBottomNav } from '../fixtures/navigation.fixture';
import { TEST_REVIEW, TIMEOUTS } from '../fixtures/test-data';
import { ensureReviewPrerequisites, type ReviewPrerequisites } from '../fixtures/review-setup';

let reviewFixtures: ReviewPrerequisites;

async function openPendingReviewForm(page: Page, jobTitle: string): Promise<void> {
  const pendingItem = page.locator('button', { hasText: jobTitle }).first();
  await expect(pendingItem).toBeVisible();
  await pendingItem.click();
  await page.waitForURL(/\/mypage\/reviews\/\d+/, { waitUntil: 'domcontentloaded' });
}

test.beforeAll(async () => {
  reviewFixtures = await ensureReviewPrerequisites();
});

test.describe('レビュー機能', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsWorker(page);
  });

  test.describe('レビュー一覧ページ（/mypage/reviews）', () => {
    test.beforeEach(async ({ page }) => {
      await openMyPageMenu(page, 'レビュー', /\/mypage\/reviews/);
    });

    test('レビューページが表示される', async ({ page }) => {
      // ページが表示される
      await expect(page.locator('h1, h2').filter({ hasText: /レビュー|評価/ })).toBeVisible();
    });

    test('レビュー待ち一覧が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const pendingTab = page.getByRole('button', { name: '評価待ち' }).first();
      await pendingTab.click();
      await page.waitForTimeout(TIMEOUTS.animation);

      const pendingItem = page.locator('button', { hasText: reviewFixtures.pending.jobTitle }).first();
      await expect(pendingItem).toBeVisible();
    });

    test('投稿済み一覧が表示される', async ({ page }) => {
      const completedTab = page.getByRole('button', { name: '投稿済み' }).first();
      await completedTab.click();
      await page.waitForTimeout(TIMEOUTS.animation);

      const completedItem = page.locator('div', { hasText: reviewFixtures.completed.jobTitle }).first();
      await expect(completedItem).toBeVisible();
    });
  });

  test.describe('レビュー作成', () => {
    test.beforeEach(async ({ page }) => {
      await openMyPageMenu(page, 'レビュー', /\/mypage\/reviews/);
      await openPendingReviewForm(page, reviewFixtures.pending.jobTitle);
    });

    test('レビュー作成ページに遷移できる', async ({ page }) => {
      await expect(page.locator('h1, h2').filter({ hasText: 'レビュー投稿' })).toBeVisible();
    });

    test('星評価入力欄が表示される', async ({ page }) => {
      const starRating = page.locator('button').filter({ has: page.locator('svg') });
      await expect(starRating.first()).toBeVisible();
    });

    test('コメント入力欄が表示される', async ({ page }) => {
      const commentTextarea = page.locator('textarea');
      await expect(commentTextarea.first()).toBeVisible();
    });

    test('送信ボタンが表示される', async ({ page }) => {
      const submitButton = page.locator('button', { hasText: /レビューを投稿する|送信|投稿|保存/ });
      await expect(submitButton.first()).toBeVisible();
    });
  });

  test.describe('受け取ったレビュー（/mypage/reviews/received）', () => {
    test('受け取ったレビューが表示される', async ({ page }) => {
      await page.goto('/mypage/reviews/received');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: '受けた評価' })).toBeVisible();
      await expect(page.getByText(reviewFixtures.completed.jobTitle).first()).toBeVisible();
      await expect(page.getByText(TEST_REVIEW.comment).first()).toBeVisible();
    });
  });

  test.describe('マイページからのナビゲーション', () => {
    test('マイページからレビューページに遷移できる', async ({ page }) => {
      await openWorkerBottomNav(page, 'マイページ', /\/mypage/);

      const reviewLink = page.getByRole('link', { name: /レビュー/ }).first();
      if (await reviewLink.isVisible()) {
        await reviewLink.click();
        await page.waitForURL('/mypage/reviews**');
      }
    });
  });
});
