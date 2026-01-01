import { test, expect } from '@playwright/test';
import { loginAsFacilityAdmin } from '../fixtures/auth.fixture';

/**
 * 求人管理ソート機能のE2Eテスト
 *
 * 対象デバッグシートID: #72
 * 実装ファイル:
 * - app/admin/jobs/page.tsx
 * - hooks/useAdminJobs.ts
 * - src/lib/actions/job-management.ts
 */

test.describe('求人管理ソート機能', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFacilityAdmin(page);
  });

  test('ソートセレクトが表示される', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの存在確認
    const sortSelect = page.locator('select[name="sort"]');
    await expect(sortSelect).toBeVisible();

    // デフォルト値が「作成日（新しい順）」であること
    await expect(sortSelect).toHaveValue('created_desc');
  });

  test('作成日順（新しい順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs?sort=created_desc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値を確認
    const sortSelect = page.locator('select[name="sort"]');
    await expect(sortSelect).toHaveValue('created_desc');
  });

  test('作成日順（古い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs?sort=created_asc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値を確認
    const sortSelect = page.locator('select[name="sort"]');
    await expect(sortSelect).toHaveValue('created_asc');
  });

  test('応募数順（多い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'applied_desc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/sort=applied_desc/);
  });

  test('応募数順（少ない順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'applied_asc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/sort=applied_asc/);
  });

  test('時給順（高い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'wage_desc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/sort=wage_desc/);
  });

  test('時給順（低い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'wage_asc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/sort=wage_asc/);
  });

  test('勤務日順（近い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'workDate_asc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/sort=workDate_asc/);
  });

  test('ソート変更でURLが更新される', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // 初期状態ではsortパラメータがない（デフォルト）
    expect(page.url()).not.toContain('sort=');

    // ソート変更
    await page.selectOption('select[name="sort"]', 'wage_desc');
    await page.waitForTimeout(500);

    // URLにsortパラメータが追加される
    await expect(page).toHaveURL(/sort=wage_desc/);

    // デフォルトに戻すとsortパラメータが消える
    await page.selectOption('select[name="sort"]', 'created_desc');
    await page.waitForTimeout(500);

    // created_descはデフォルトなのでURLから消える
    expect(page.url()).not.toContain('sort=');
  });

  test('URLパラメータからソート状態が復元される', async ({ page }) => {
    // URLにソートパラメータを含めて直接アクセス
    await page.goto('/admin/jobs?sort=wage_desc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値が正しく設定されていること
    const sortSelect = page.locator('select[name="sort"]');
    await expect(sortSelect).toHaveValue('wage_desc');
  });

  test('ページネーション時にソートが維持される', async ({ page }) => {
    await page.goto('/admin/jobs?sort=wage_desc');
    await page.waitForLoadState('networkidle');

    // 次ページボタンが存在すれば次ページへ移動
    const nextButton = page.locator('button:has-text("次へ")');
    if (await nextButton.isVisible() && !(await nextButton.isDisabled())) {
      await nextButton.click();
      await page.waitForTimeout(1000);

      // ソートが維持されていること
      await expect(page).toHaveURL(/sort=wage_desc/);
    }
  });

  test('ステータスフィルタとソートが同時に機能する', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // ステータスフィルタを適用（公開中）
    const recruitingButton = page.locator('button:has-text("公開中")');
    if (await recruitingButton.isVisible()) {
      await recruitingButton.click();
      await page.waitForTimeout(500);
    }

    // ソートを変更
    await page.selectOption('select[name="sort"]', 'wage_desc');
    await page.waitForTimeout(500);

    // 両方のパラメータがURLに含まれる
    const url = page.url();
    expect(url).toContain('status=recruiting');
    expect(url).toContain('sort=wage_desc');
  });

  test('全てのソートオプションが選択可能', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    const sortSelect = page.locator('select[name="sort"]');
    const options = await sortSelect.locator('option').all();

    // 7つのオプションがあること
    expect(options.length).toBe(7);

    // 各オプションの値を確認
    const expectedOptions = [
      'created_desc',
      'created_asc',
      'applied_desc',
      'applied_asc',
      'wage_desc',
      'wage_asc',
      'workDate_asc',
    ];

    for (let i = 0; i < expectedOptions.length; i++) {
      const value = await options[i].getAttribute('value');
      expect(value).toBe(expectedOptions[i]);
    }
  });
});
