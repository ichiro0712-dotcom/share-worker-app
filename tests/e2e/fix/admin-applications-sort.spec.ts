import { test, expect } from '@playwright/test';
import { loginAsFacilityAdmin } from '../fixtures/auth.fixture';

/**
 * 応募管理ソート機能のE2Eテスト
 *
 * 対象デバッグシートID: #72
 * 実装ファイル:
 * - app/admin/applications/page.tsx
 * - hooks/useApplications.ts
 * - src/lib/actions/application-admin.ts
 */

test.describe('応募管理求人ビューソート機能', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFacilityAdmin(page);
  });

  test('ソートセレクトが表示される', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの存在確認
    const sortSelect = page.locator('select[name="jobSort"]');
    await expect(sortSelect).toBeVisible();

    // デフォルト値が「作成日（新しい順）」であること
    await expect(sortSelect).toHaveValue('created_desc');
  });

  test('作成日順（新しい順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications?jobSort=created_desc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値を確認
    const sortSelect = page.locator('select[name="jobSort"]');
    await expect(sortSelect).toHaveValue('created_desc');
  });

  test('作成日順（古い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications?jobSort=created_asc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値を確認
    const sortSelect = page.locator('select[name="jobSort"]');
    await expect(sortSelect).toHaveValue('created_asc');
  });

  test('応募数順（多い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'applied_desc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/jobSort=applied_desc/);
  });

  test('応募数順（少ない順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'applied_asc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/jobSort=applied_asc/);
  });

  test('未確認応募順（多い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'unviewed_desc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/jobSort=unviewed_desc/);
  });

  test('勤務日順（近い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'workDate_asc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/jobSort=workDate_asc/);
  });

  test('勤務日順（遠い順）でソートできる', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'workDate_desc');
    await page.waitForTimeout(1000);

    // URLが更新されることを確認
    await expect(page).toHaveURL(/jobSort=workDate_desc/);
  });

  test('ソート変更でURLが更新される', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // 初期状態ではjobSortパラメータがない（デフォルト）
    expect(page.url()).not.toContain('jobSort=');

    // ソート変更
    await page.selectOption('select[name="jobSort"]', 'applied_desc');
    await page.waitForTimeout(500);

    // URLにjobSortパラメータが追加される
    await expect(page).toHaveURL(/jobSort=applied_desc/);

    // デフォルトに戻すとjobSortパラメータが消える
    await page.selectOption('select[name="jobSort"]', 'created_desc');
    await page.waitForTimeout(500);

    // created_descはデフォルトなのでURLから消える
    expect(page.url()).not.toContain('jobSort=');
  });

  test('URLパラメータからソート状態が復元される', async ({ page }) => {
    // URLにソートパラメータを含めて直接アクセス
    await page.goto('/admin/applications?jobSort=applied_desc');
    await page.waitForLoadState('networkidle');

    // ソートセレクトの値が正しく設定されていること
    const sortSelect = page.locator('select[name="jobSort"]');
    await expect(sortSelect).toHaveValue('applied_desc');
  });

  test('ステータスフィルタとソートが同時に機能する', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ステータスフィルタを適用（公開中）
    const publishedButton = page.locator('button:has-text("公開中")');
    if (await publishedButton.isVisible()) {
      await publishedButton.click();
      await page.waitForTimeout(500);
    }

    // ソートを変更
    await page.selectOption('select[name="jobSort"]', 'applied_desc');
    await page.waitForTimeout(500);

    // 両方のパラメータがURLに含まれる
    const url = page.url();
    expect(url).toContain('status=published');
    expect(url).toContain('jobSort=applied_desc');
  });

  test('全てのソートオプションが選択可能', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    const sortSelect = page.locator('select[name="jobSort"]');
    const options = await sortSelect.locator('option').all();

    // 7つのオプションがあること
    expect(options.length).toBe(7);

    // 各オプションの値を確認
    const expectedOptions = [
      'created_desc',
      'created_asc',
      'applied_desc',
      'applied_asc',
      'unviewed_desc',
      'workDate_asc',
      'workDate_desc',
    ];

    for (let i = 0; i < expectedOptions.length; i++) {
      const value = await options[i].getAttribute('value');
      expect(value).toBe(expectedOptions[i]);
    }
  });

  test('ワーカービューではジョブソートが表示されない', async ({ page }) => {
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // ワーカービューに切り替え
    await page.click('button:has-text("ワーカーから")');
    await page.waitForTimeout(500);

    // ジョブソートセレクトが表示されないこと
    const jobSortSelect = page.locator('select[name="jobSort"]');
    await expect(jobSortSelect).not.toBeVisible();
  });
});
