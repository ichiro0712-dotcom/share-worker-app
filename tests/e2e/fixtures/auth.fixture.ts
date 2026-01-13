import { Page, Locator, expect } from '@playwright/test';
import { loadTestAccounts } from './test-accounts';

// テスト用のアカウント情報
export const TEST_ACCOUNTS = loadTestAccounts();

/**
 * ワーカーとしてログイン
 */
export async function loginAsWorker(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.fill(TEST_ACCOUNTS.worker.email);
  await passwordInput.fill(TEST_ACCOUNTS.worker.password);
  await submitButton.click();

  // ログイン成功を待つ（複数のパターンに対応）
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') || url.pathname.includes('/mypage'),
    { timeout: 15000 }
  ).catch(() => {
    // タイムアウトしても続行（既にログイン済みの可能性）
    console.log('Worker login: URL change timeout, continuing...');
  });

  await page.waitForLoadState('networkidle');
}

/**
 * 施設管理者としてログイン
 */
export async function loginAsFacilityAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.fill(TEST_ACCOUNTS.facilityAdmin.email);
  await passwordInput.fill(TEST_ACCOUNTS.facilityAdmin.password);
  await submitButton.click();

  // ログイン成功を待つ
  await page.waitForURL(
    (url) => url.pathname.startsWith('/admin') && !url.pathname.endsWith('/login'),
    { timeout: 15000 }
  ).catch(() => {
    console.log('Facility admin login: URL change timeout, continuing...');
  });

  await page.waitForLoadState('networkidle');
}

/**
 * システム管理者としてログイン
 */
export async function loginAsSystemAdmin(page: Page): Promise<void> {
  await page.goto('/system-admin/login');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.fill(TEST_ACCOUNTS.systemAdmin.email);
  await passwordInput.fill(TEST_ACCOUNTS.systemAdmin.password);
  await submitButton.click();

  // ログイン成功を待つ
  await page.waitForURL(
    (url) => url.pathname.startsWith('/system-admin') && !url.pathname.endsWith('/login'),
    { timeout: 15000 }
  ).catch(() => {
    console.log('System admin login: URL change timeout, continuing...');
  });

  await page.waitForLoadState('networkidle');
}

/**
 * ログアウト（ワーカー側）
 */
export async function logoutAsWorker(page: Page): Promise<void> {
  await page.goto('/mypage');
  const logoutButton = page.locator('text=ログアウト');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL('/login');
  }
}

/**
 * ログアウト（施設管理者側）
 */
export async function logoutAsFacilityAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  const logoutButton = page.locator('text=ログアウト');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    const confirmText = page.locator('text=ログアウトしますか？');
    if (await confirmText.isVisible()) {
      const confirmButton = confirmText.locator('..').locator('button', { hasText: 'ログアウト' });
      await confirmButton.click();
    }
    await page.waitForURL('/admin/login');
  }
}

// ============================================
// バリデーションヘルパー関数
// ============================================

/**
 * 入力フィールドにエラースタイル（赤枠）が適用されているか確認
 */
export async function hasErrorBorder(input: Locator): Promise<boolean> {
  const classes = await input.getAttribute('class') || '';
  // Tailwind CSSの赤枠クラスをチェック
  return (
    classes.includes('border-red') ||
    classes.includes('ring-red') ||
    classes.includes('border-error') ||
    classes.includes('border-destructive')
  );
}

/**
 * 入力フィールドの近くにエラーメッセージが表示されているか確認
 */
export async function hasErrorMessage(page: Page, fieldLocator: Locator, errorText?: string): Promise<boolean> {
  // 親要素からエラーメッセージを探す
  const parent = fieldLocator.locator('..');
  const errorElement = parent.locator('.text-red-500, .text-error, .text-destructive, [role="alert"]');

  if (await errorElement.isVisible()) {
    if (errorText) {
      const text = await errorElement.textContent();
      return text?.includes(errorText) || false;
    }
    return true;
  }
  return false;
}

/**
 * フォーム送信時にバリデーションエラーが発生するか確認
 */
export async function submitFormAndCheckValidation(
  page: Page,
  submitButton: Locator
): Promise<{ hasErrors: boolean; errorCount: number }> {
  await submitButton.click();
  await page.waitForTimeout(500); // バリデーション処理待ち

  // エラー表示要素を収集
  const errorElements = page.locator('.text-red-500, .text-error, .border-red-500, [role="alert"]');
  const errorCount = await errorElements.count();

  return {
    hasErrors: errorCount > 0,
    errorCount,
  };
}

/**
 * 必須フィールドを空にしてエラーが出るか確認
 */
export async function testRequiredFieldValidation(
  page: Page,
  inputLocator: Locator,
  submitButton: Locator
): Promise<boolean> {
  // フィールドをクリアして送信
  await inputLocator.clear();
  await inputLocator.blur();
  await page.waitForTimeout(300);

  // エラー表示を確認（送信前のリアルタイムバリデーション）
  if (await hasErrorBorder(inputLocator)) {
    return true;
  }

  // 送信ボタンクリック後のバリデーション
  await submitButton.click();
  await page.waitForTimeout(500);

  return await hasErrorBorder(inputLocator);
}

/**
 * カタカナのみ許可されるフィールドのバリデーションテスト
 */
export async function testKatakanaOnlyValidation(
  page: Page,
  inputLocator: Locator,
  invalidInputs: string[]
): Promise<{ input: string; hasError: boolean }[]> {
  const results: { input: string; hasError: boolean }[] = [];

  for (const invalidInput of invalidInputs) {
    await inputLocator.clear();
    await inputLocator.fill(invalidInput);
    await inputLocator.blur();
    await page.waitForTimeout(300);

    const hasError = await hasErrorBorder(inputLocator);
    results.push({ input: invalidInput, hasError });
  }

  return results;
}

/**
 * メールアドレス形式のバリデーションテスト
 */
export async function testEmailValidation(
  page: Page,
  inputLocator: Locator,
  invalidEmails: string[]
): Promise<{ email: string; hasError: boolean }[]> {
  const results: { email: string; hasError: boolean }[] = [];

  for (const invalidEmail of invalidEmails) {
    await inputLocator.clear();
    await inputLocator.fill(invalidEmail);
    await inputLocator.blur();
    await page.waitForTimeout(300);

    const hasError = await hasErrorBorder(inputLocator);
    results.push({ email: invalidEmail, hasError });
  }

  return results;
}

/**
 * パスワードバリデーションテスト
 */
export async function testPasswordValidation(
  page: Page,
  inputLocator: Locator,
  weakPasswords: string[]
): Promise<{ password: string; hasError: boolean }[]> {
  const results: { password: string; hasError: boolean }[] = [];

  for (const weakPassword of weakPasswords) {
    await inputLocator.clear();
    await inputLocator.fill(weakPassword);
    await inputLocator.blur();
    await page.waitForTimeout(300);

    const hasError = await hasErrorBorder(inputLocator);
    results.push({ password: weakPassword, hasError });
  }

  return results;
}

/**
 * 郵便番号入力で都道府県が自動入力されるかテスト
 */
export async function testPostalCodeAutoFill(
  page: Page,
  postalCodeInput: Locator,
  prefectureInput: Locator,
  postalCode: string,
  expectedPrefecture: string
): Promise<boolean> {
  await postalCodeInput.clear();
  await postalCodeInput.fill(postalCode);
  await postalCodeInput.blur();
  await page.waitForTimeout(1000); // API呼び出し待ち

  const prefectureValue = await prefectureInput.inputValue();
  return prefectureValue === expectedPrefecture;
}

/**
 * 過去の日付が選択不可かテスト
 */
export async function testPastDateRejection(
  page: Page,
  dateInput: Locator
): Promise<boolean> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedDate = yesterday.toISOString().split('T')[0];

  await dateInput.fill(formattedDate);
  await dateInput.blur();
  await page.waitForTimeout(300);

  return await hasErrorBorder(dateInput);
}

/**
 * トーストメッセージの表示を確認
 */
export async function waitForToast(
  page: Page,
  expectedText?: string,
  timeout: number = 5000
): Promise<Locator | null> {
  const toastSelector = '[data-testid="toast"], .Toastify__toast, [role="alert"]:not(#__next-route-announcer__), [role="status"], .toast';
  const toast = expectedText
    ? page.locator(toastSelector, { hasText: expectedText }).first()
    : page.locator(toastSelector).first();

  try {
    await toast.waitFor({ state: 'visible', timeout });
    return toast;
  } catch {
    return null;
  }
}

/**
 * フォーム全体のバリデーション状態をチェック
 */
export async function getFormValidationState(page: Page): Promise<{
  invalidFields: number;
  errorMessages: string[];
}> {
  const errorElements = page.locator('.text-red-500, .text-error, .text-destructive');
  const invalidInputs = page.locator('.border-red-500, .border-error, .ring-red-500');

  const invalidFields = await invalidInputs.count();
  const errorMessageElements = await errorElements.all();

  const errorMessages: string[] = [];
  for (const el of errorMessageElements) {
    const text = await el.textContent();
    if (text) {
      errorMessages.push(text.trim());
    }
  }

  return {
    invalidFields,
    errorMessages,
  };
}

/**
 * フォーム送信が無効化されているか確認（ボタンのdisabled状態）
 */
export async function isSubmitDisabled(submitButton: Locator): Promise<boolean> {
  const isDisabled = await submitButton.isDisabled();
  const classes = await submitButton.getAttribute('class') || '';
  const hasDisabledStyle = classes.includes('disabled') || classes.includes('cursor-not-allowed');

  return isDisabled || hasDisabledStyle;
}
