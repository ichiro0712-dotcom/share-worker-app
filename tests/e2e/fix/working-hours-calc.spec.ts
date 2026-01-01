import { test, expect } from '@playwright/test';
import { loginAsFacilityAdmin } from '../fixtures/auth.fixture';

/**
 * #48 実働時間自動計算機能のE2Eテスト
 * テンプレート作成画面・求人作成画面で勤務時間から実働時間が自動計算されることを確認
 *
 * 前提条件:
 * - データベースにテスト管理者アカウントが存在すること（prisma/seed.ts を実行）
 * - admin1@facility.com / password123 でログイン可能であること
 */

test.describe('実働時間自動計算機能', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFacilityAdmin(page);
  });

  test('テンプレート作成画面で実働時間が表示される', async ({ page }) => {
    // テンプレート作成画面に遷移
    await page.goto('/admin/jobs/templates/new');
    await page.waitForLoadState('networkidle');

    // 実働時間表示が存在することを確認
    const workingHoursDisplay = page.locator('[data-testid="working-hours-display"]');
    await expect(workingHoursDisplay).toBeVisible({ timeout: 10000 });

    // デフォルト値（06:00-15:00、休憩0分）で実働時間が9時間と表示されることを確認
    await expect(workingHoursDisplay).toContainText('9時間');
  });

  test('テンプレート作成画面で休憩時間変更時に実働時間が再計算される', async ({ page }) => {
    await page.goto('/admin/jobs/templates/new');
    await page.waitForLoadState('networkidle');

    const workingHoursDisplay = page.locator('[data-testid="working-hours-display"]');
    await expect(workingHoursDisplay).toBeVisible({ timeout: 10000 });

    // 初期状態の実働時間を確認（9時間）
    await expect(workingHoursDisplay).toContainText('9時間');

    // 休憩時間を60分に変更
    const breakTimeSelect = page.locator('select').filter({ hasText: /なし|0分/ }).first();
    await breakTimeSelect.selectOption('60');

    // 実働時間が更新されることを確認（06:00-15:00で休憩60分 = 8時間）
    await expect(workingHoursDisplay).toContainText('8時間');
  });

  test('求人作成画面で実働時間が表示される', async ({ page }) => {
    // 求人作成画面に遷移
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // 実働時間表示が存在することを確認
    const workingHoursDisplay = page.locator('[data-testid="working-hours-display"]');
    await expect(workingHoursDisplay).toBeVisible({ timeout: 10000 });
  });

  test('自動計算の説明テキストが表示される', async ({ page }) => {
    await page.goto('/admin/jobs/templates/new');
    await page.waitForLoadState('networkidle');

    // 説明テキストが表示されることを確認
    const descriptionText = page.locator('text=開始時刻・終了時刻・休憩時間から自動計算されます');
    await expect(descriptionText).toBeVisible({ timeout: 10000 });
  });
});
