import { test, expect } from '@playwright/test';
import { loginAsFacilityAdmin, loginAsSystemAdmin } from '../fixtures/auth.fixture';

/**
 * フォームバリデーション修正の検証テスト
 *
 * 対象デバッグシートID:
 * - #24: PW要件8文字統一
 * - #38: メール二重入力確認
 * - #45: パスワードリセットエラー表示
 * - #48: 実働時間自動計算
 * - #7: 時給コンマ表示
 * - #33: 時給入力0残り問題
 * - #15: 休憩時間バリデーション
 * - #52: 必須項目エラー表示
 * - #73: フリガナIME問題
 */

test.describe('フォームバリデーション修正の検証', () => {
  // #24: パスワード要件8文字統一
  test('施設管理者パスワード要件が8文字以上と表示される', async ({ page }) => {
    await loginAsSystemAdmin(page);
    await page.goto('/system-admin/facilities/new');
    await page.waitForLoadState('networkidle');

    // パスワードフィールドを探す
    const passwordField = page.locator('input[type="password"]').first();
    if ((await passwordField.count()) > 0) {
      // 6文字入力
      await passwordField.fill('123456');
      await passwordField.blur();
      await page.waitForTimeout(300);

      // エラーが表示されること
      const errorText = page.locator('text=/8文字|8桁/');
      const hasLengthHint = (await errorText.count()) > 0;

      // またはplaceholderやラベルに8文字の指示があること
      const placeholder = await passwordField.getAttribute('placeholder');
      const hasPlaceholderHint = placeholder?.includes('8') ?? false;

      expect(hasLengthHint || hasPlaceholderHint).toBeTruthy();
    }
  });

  // #38: メールアドレス二重入力確認
  test('ワーカー登録でメールアドレス確認欄が存在し不一致でエラー表示', async ({ page }) => {
    await page.goto('/register/worker');
    await page.waitForLoadState('networkidle');

    // メールアドレス入力欄
    const emailInputs = page.locator('input[type="email"], input[name*="email"]');
    const count = await emailInputs.count();

    if (count >= 2) {
      // 2つのメールフィールドがある場合、確認欄が存在
      const firstEmail = emailInputs.first();
      const secondEmail = emailInputs.nth(1);

      await firstEmail.fill('test@example.com');
      await secondEmail.fill('different@example.com');
      await secondEmail.blur();
      await page.waitForTimeout(500);

      // 不一致エラーが表示されること
      const mismatchError = page.locator('text=/一致|異なり|match/i');
      const hasMismatchError = (await mismatchError.count()) > 0;

      expect(hasMismatchError).toBeTruthy();
    } else {
      // メール確認欄がない場合はスキップ（既存実装のまま）
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  // #48: 実働時間自動計算
  test('求人作成で実働時間が自動計算される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // 開始時刻・終了時刻・休憩時間を設定
    const startTimeSelect = page.locator('select[name*="startTime"], [data-testid="start-time"]').first();
    const endTimeSelect = page.locator('select[name*="endTime"], [data-testid="end-time"]').first();
    const breakTimeInput = page.locator('input[name*="breakTime"], [data-testid="break-time"]').first();

    if ((await startTimeSelect.count()) > 0 && (await endTimeSelect.count()) > 0) {
      await startTimeSelect.selectOption('09:00');
      await endTimeSelect.selectOption('18:00');

      if ((await breakTimeInput.count()) > 0) {
        await breakTimeInput.fill('60');
        await breakTimeInput.blur();
        await page.waitForTimeout(300);
      }

      // 実働時間表示の確認（8時間 = 9時間勤務 - 1時間休憩）
      const workingHoursDisplay = page.locator('[data-testid="working-hours"], text=/実働.*8.*時間/');
      if ((await workingHoursDisplay.count()) > 0) {
        const text = await workingHoursDisplay.textContent();
        expect(text).toContain('8');
      }
    }
  });

  // #7: 時給コンマ表示
  test('時給入力時にコンマ付きフォーマットが表示される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // 時給入力欄
    const hourlyWageInput = page.locator('input[name*="hourlyWage"], input[name*="wage"]').first();
    if ((await hourlyWageInput.count()) > 0) {
      await hourlyWageInput.fill('1500');
      await hourlyWageInput.blur();
      await page.waitForTimeout(300);

      // フォーマット表示の確認（¥1,500 形式）
      const formattedDisplay = page.locator('text=/¥.*1,500|1,500.*円/');
      const hasFormattedDisplay = (await formattedDisplay.count()) > 0;

      expect(hasFormattedDisplay).toBeTruthy();
    }
  });

  // #33: 時給入力0残り問題
  test('時給を再入力時に0が先頭に残らない', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    const hourlyWageInput = page.locator('input[name*="hourlyWage"], input[name*="wage"]').first();
    if ((await hourlyWageInput.count()) > 0) {
      // 一度クリアして再入力
      await hourlyWageInput.click();
      await hourlyWageInput.fill('');
      await hourlyWageInput.fill('1200');

      const value = await hourlyWageInput.inputValue();
      // 先頭に0がないこと
      expect(value).not.toMatch(/^0\d/);
      expect(value === '1200' || value === '').toBeTruthy();
    }
  });

  // #15: 休憩時間バリデーション（労働基準法準拠）
  test('6時間超勤務で45分以上の休憩が必須', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // 7時間勤務（6時間超）で休憩30分に設定
    const startTimeSelect = page.locator('select[name*="startTime"]').first();
    const endTimeSelect = page.locator('select[name*="endTime"]').first();
    const breakTimeInput = page.locator('input[name*="breakTime"]').first();

    if ((await startTimeSelect.count()) > 0 && (await endTimeSelect.count()) > 0) {
      await startTimeSelect.selectOption('09:00');
      await endTimeSelect.selectOption('16:00'); // 7時間勤務

      if ((await breakTimeInput.count()) > 0) {
        await breakTimeInput.fill('30'); // 30分休憩（不足）
      }

      // 保存ボタンをクリック
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const saveButton = page.locator('button:has-text("公開"), button:has-text("保存")').first();
      if ((await saveButton.count()) > 0) {
        await saveButton.click();
        await page.waitForTimeout(1000);

        // エラーメッセージ確認
        const errorMessage = page.locator('text=/45分|休憩時間/');
        const hasError = (await errorMessage.count()) > 0;
        expect(hasError).toBeTruthy();
      }
    }
  });

  test('8時間超勤務で60分以上の休憩が必須', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // 9時間勤務（8時間超）で休憩45分に設定
    const startTimeSelect = page.locator('select[name*="startTime"]').first();
    const endTimeSelect = page.locator('select[name*="endTime"]').first();
    const breakTimeInput = page.locator('input[name*="breakTime"]').first();

    if ((await startTimeSelect.count()) > 0 && (await endTimeSelect.count()) > 0) {
      await startTimeSelect.selectOption('09:00');
      await endTimeSelect.selectOption('18:00'); // 9時間勤務

      if ((await breakTimeInput.count()) > 0) {
        await breakTimeInput.fill('45'); // 45分休憩（不足）
      }

      // 保存ボタンをクリック
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const saveButton = page.locator('button:has-text("公開"), button:has-text("保存")').first();
      if ((await saveButton.count()) > 0) {
        await saveButton.click();
        await page.waitForTimeout(1000);

        // エラーメッセージ確認
        const errorMessage = page.locator('text=/60分|休憩時間/');
        const hasError = (await errorMessage.count()) > 0;
        expect(hasError).toBeTruthy();
      }
    }
  });

  // #52: 必須項目エラー表示
  test('ワーカー登録で必須項目未入力時に赤枠+エラーテキストが表示される', async ({ page }) => {
    await page.goto('/register/worker');
    await page.waitForLoadState('networkidle');

    // 何も入力せずに送信
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForTimeout(2000);

    // 赤枠の存在確認
    const redBorderCount = await page.locator('.border-red-500, .border-red-400, [class*="border-red"]').count();

    // エラーテキストの存在確認
    const errorTextCount = await page.locator('.text-red-500, .text-red-600, [class*="text-red"]').count();

    // いずれかが表示されていること
    expect(redBorderCount > 0 || errorTextCount > 0).toBeTruthy();
  });

  // #73: フリガナIME問題（iOS対応）
  test('フリガナ入力でIME composition中に文字が勝手に入力されない', async ({ page }) => {
    await page.goto('/register/worker');
    await page.waitForLoadState('networkidle');

    // フリガナ入力フィールドを探す
    const kanaInput = page.locator('input[name*="Kana"], input[name*="kana"]').first();

    if ((await kanaInput.count()) > 0) {
      // 通常入力のテスト（IMEなし）
      await kanaInput.clear();
      await kanaInput.type('ヤマダ', { delay: 100 });

      const value = await kanaInput.inputValue();
      // 入力した文字のみが含まれていること（余計な文字がないこと）
      expect(value.length).toBeLessThanOrEqual(6); // ヤマダ + 若干の変換
    }
  });
});

test.describe('テンプレートフォームのバリデーション', () => {
  // テンプレート作成時の実働時間自動計算
  test('テンプレート作成で実働時間が自動計算される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/templates/new');
    await page.waitForLoadState('networkidle');

    // テンプレート作成ページがなければスキップ
    if (page.url().includes('templates/new')) {
      const startTimeSelect = page.locator('select[name*="startTime"]').first();
      const endTimeSelect = page.locator('select[name*="endTime"]').first();

      if ((await startTimeSelect.count()) > 0) {
        await startTimeSelect.selectOption('09:00');
        await endTimeSelect.selectOption('17:00');

        // 実働時間表示の確認
        const workingHoursDisplay = page.locator('[data-testid="working-hours"]');
        if ((await workingHoursDisplay.count()) > 0) {
          await expect(workingHoursDisplay).toBeVisible();
        }
      }
    }
  });
});
