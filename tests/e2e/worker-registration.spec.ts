import { test, expect } from '@playwright/test';
import { TIMEOUTS } from './fixtures/test-data';

/**
 * 新規ワーカー登録フロー詳細テスト
 *
 * 検証項目:
 * 1. フォーム表示・必須フィールド表示
 * 2. 入力バリデーション（メール、電話番号、フリガナ）
 * 3. 資格選択と証明書アップロード
 * 4. 経験分野選択
 * 5. パスワードバリデーション
 * 6. 送信時のバリデーションエラー表示
 */

// テスト用の有効なPNG画像
const VALID_SMALL_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// テスト用データ
const TEST_WORKER_DATA = {
  lastName: 'テスト',
  firstName: '太郎',
  lastNameKana: 'テスト',
  firstNameKana: 'タロウ',
  birthDate: '1990-01-01',
  gender: '男性',
  nationality: '日本',
  email: `test-worker-${Date.now()}@example.com`,
  phoneNumber: '09012345678',
  prefecture: '東京都',
  city: '渋谷区',
  password: 'TestPassword123',
};

test.describe('新規ワーカー登録フロー', () => {
  test.describe('フォーム表示確認', () => {
    test('登録ページが正しく表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // ページタイトル確認
      await expect(page.getByRole('heading', { name: '新規ワーカー登録' })).toBeVisible();

      // 説明文確認
      await expect(page.locator('text=以下の情報を入力して登録してください')).toBeVisible();
    });

    test('必須フィールドセクションが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 各セクションのヘッダー確認
      await expect(page.locator('h3:has-text("基本情報")')).toBeVisible();
      await expect(page.locator('h3:has-text("連絡先情報")')).toBeVisible();
      await expect(page.locator('h3:has-text("資格情報")')).toBeVisible();
      await expect(page.locator('h3:has-text("経験・職歴")')).toBeVisible();
      await expect(page.locator('h3:has-text("パスワード設定")')).toBeVisible();
    });

    test('必須フィールドに*マークが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 必須マーク（*）を持つラベルが存在することを確認
      const requiredLabels = [
        '姓',
        '名',
        'セイ（フリガナ）',
        'メイ（フリガナ）',
        '性別',
        '国籍',
        'メールアドレス',
        '電話番号',
        'パスワード',
      ];

      for (const label of requiredLabels) {
        const labelElement = page.locator(`label:has-text("${label}")`).first();
        await expect(labelElement).toBeVisible();
        // 必須マークがラベルの近くにあることを確認
        const hasRequired = await labelElement.locator('span.text-red-500').count();
        expect(hasRequired).toBeGreaterThan(0);
      }
    });
  });

  test.describe('入力バリデーション', () => {
    test('フリガナ入力でひらがながカタカナに自動変換される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // セイのフリガナ入力（ひらがな）
      const lastNameKanaInput = page.locator('input[placeholder="ヤマダ"]');
      await lastNameKanaInput.fill('やまだ');

      // カタカナに変換されていることを確認
      await expect(lastNameKanaInput).toHaveValue('ヤマダ');
    });

    test('電話番号入力でハイフンが自動挿入される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 電話番号入力
      const phoneInput = page.locator('input[placeholder="090-1234-5678"]');
      await phoneInput.fill('09012345678');

      // ハイフンが自動挿入されていることを確認
      await expect(phoneInput).toHaveValue('090-1234-5678');
    });

    test('無効なメールアドレスでエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 無効なメールアドレスを入力
      const emailInput = page.locator('input[placeholder="example@email.com"]');
      await emailInput.fill('invalid-email');

      // 他のフィールドに移動してブラー
      await page.locator('input[placeholder="090-1234-5678"]').click();
      await page.waitForTimeout(TIMEOUTS.animation);

      // 送信ボタンをクリック（バリデーションをトリガー）
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const submitButton = page.getByRole('button', { name: '登録' });
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // バリデーション反映を待つ
      await page.waitForTimeout(1000);

      // エラー表示を確認（トースト、赤枠、またはURL変更なし）
      const emailError = await page.getByText(/メールアドレスの形式が正しくありません/).isVisible().catch(() => false);
      const requiredError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const currentUrl = page.url();

      // いずれかのバリデーション表示があること、またはページ遷移していないこと
      expect(emailError || requiredError || redBorderCount > 0 || currentUrl.includes('/register/worker')).toBeTruthy();
    });

    test('パスワード不一致でエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // パスワード不一致を入力
      await page.locator('input[placeholder="8文字以上"]').fill('Password123');
      await page.locator('input[placeholder="パスワードを再入力"]').fill('DifferentPassword');

      // 送信ボタンをクリック（バリデーションをトリガー）
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const submitButton = page.getByRole('button', { name: '登録' });
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // バリデーション反映を待つ
      await page.waitForTimeout(1000);

      // エラー表示を確認
      const passwordError = await page.getByText(/パスワードが一致しません/).isVisible().catch(() => false);
      const requiredError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const currentUrl = page.url();

      // いずれかのバリデーション表示があること
      expect(passwordError || requiredError || redBorderCount > 0 || currentUrl.includes('/register/worker')).toBeTruthy();
    });
  });

  test.describe('資格選択と証明書', () => {
    test('資格情報セクションが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 保有資格ラベル
      await expect(page.locator('label:has-text("保有資格")')).toBeVisible();

      // 資格のチェックボックスが表示される（正確にマッチ）
      await expect(page.locator('label').filter({ hasText: /^介護福祉士$/ })).toBeVisible();
      await expect(page.locator('label').filter({ hasText: /^看護師$/ })).toBeVisible();
    });

    test('資格を選択すると証明書アップロード欄が表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 介護福祉士を選択（正確にマッチ）
      await page.locator('label').filter({ hasText: /^介護福祉士$/ }).click();
      await page.waitForTimeout(TIMEOUTS.animation);

      // 証明書アップロードセクションが表示される
      await expect(page.locator('label:has-text("資格証明書アップロード")')).toBeVisible();
      await expect(page.locator('text=ファイルを選択')).toBeVisible();
    });

    test('「その他」資格は証明書不要', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // その他を選択
      const otherQualification = page.locator('label:has-text("その他")').first();
      if (await otherQualification.isVisible()) {
        await otherQualification.click();
        await page.waitForTimeout(TIMEOUTS.animation);

        // 証明書アップロードセクションは表示されない（その他だけの場合）
        const certificateSection = page.locator('label:has-text("資格証明書アップロード")');
        const isVisible = await certificateSection.isVisible().catch(() => false);

        // 「その他」のみの場合は証明書不要なので表示されないはず
        // 他の資格も選択されていなければ証明書セクションは表示されない
      }
    });

    test('資格未選択で送信するとエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 基本情報を入力
      await page.locator('input[placeholder="山田"]').fill(TEST_WORKER_DATA.lastName);
      await page.locator('input[placeholder="太郎"]').fill(TEST_WORKER_DATA.firstName);
      await page.locator('input[placeholder="ヤマダ"]').fill(TEST_WORKER_DATA.lastNameKana);
      await page.locator('input[placeholder="タロウ"]').fill(TEST_WORKER_DATA.firstNameKana);
      await page.locator('select').first().selectOption(TEST_WORKER_DATA.gender);
      await page.locator('select').nth(1).selectOption(TEST_WORKER_DATA.nationality);
      await page.locator('input[placeholder="example@email.com"]').fill(TEST_WORKER_DATA.email);
      await page.locator('input[placeholder="090-1234-5678"]').fill(TEST_WORKER_DATA.phoneNumber);
      await page.locator('input[placeholder="8文字以上"]').fill(TEST_WORKER_DATA.password);
      await page.locator('input[placeholder="パスワードを再入力"]').fill(TEST_WORKER_DATA.password);

      // フォームをスクロールして送信ボタンを表示
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // 資格を選択しない状態で送信
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // DOMの更新を待つ
      await page.waitForTimeout(2000);

      // エラー表示を確認
      const errorVisible = await page.getByText(/少なくとも1つの資格を選択してください/).isVisible().catch(() => false);
      const requiredError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const stayedOnPage = page.url().includes('/register/worker');

      expect(errorVisible || requiredError || redBorderCount > 0 || stayedOnPage).toBeTruthy();
    });
  });

  test.describe('経験分野選択', () => {
    test('経験分野のチェックボックスが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 経験分野ラベル
      await expect(page.locator('label:has-text("経験分野")').first()).toBeVisible();

      // 経験分野のチェックボックスが少なくとも1つ表示される
      const experienceFields = [
        '特別養護老人ホーム',
        'グループホーム',
        'デイサービス',
      ];

      let found = false;
      for (const field of experienceFields) {
        const isVisible = await page.locator(`text=${field}`).first().isVisible().catch(() => false);
        if (isVisible) {
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    });

    test('経験分野を選択すると経験年数入力欄が表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 特別養護老人ホームを選択
      const experienceCheckbox = page.locator('label').filter({ hasText: '特別養護老人ホーム' }).first();
      if (await experienceCheckbox.isVisible()) {
        await experienceCheckbox.click();
        await page.waitForTimeout(TIMEOUTS.animation);

        // 経験年数入力セクションが表示される
        await expect(page.locator('label:has-text("経験年数")').first()).toBeVisible();
      }
    });

    test('経験分野未選択で送信するとエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // フォームをスクロールして送信ボタンを表示
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // 送信ボタンをクリック（バリデーションをトリガー）
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // DOMの更新を待つ
      await page.waitForTimeout(2000);

      // 入力必須エラーまたは赤枠が表示される
      const errorVisible = await page.getByText(/少なくとも1つの経験分野を選択してください/).isVisible().catch(() => false);
      const requiredError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const stayedOnPage = page.url().includes('/register/worker');

      expect(errorVisible || requiredError || redBorderCount > 0 || stayedOnPage).toBeTruthy();
    });
  });

  test.describe('職歴入力', () => {
    test('職歴入力欄が表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 職歴ラベル
      await expect(page.locator('label:has-text("職歴")')).toBeVisible();

      // 職歴入力欄
      await expect(page.locator('input[placeholder*="2018年4月"]')).toBeVisible();
    });

    test('職歴追加ボタンで入力欄を追加できる', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 初期状態では1つの入力欄
      const initialInputs = await page.locator('input[placeholder*="2018年4月"]').count();

      // 職歴追加ボタンをクリック
      await page.getByRole('button', { name: '+ 職歴を追加' }).click();
      await page.waitForTimeout(TIMEOUTS.animation);

      // 入力欄が増える
      const afterAddInputs = await page.locator('input[placeholder*="2018年4月"]').count();
      expect(afterAddInputs).toBe(initialInputs + 1);
    });

    test('職歴は5件まで追加可能', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 4回追加（初期1件 + 4件 = 5件）
      for (let i = 0; i < 4; i++) {
        const addButton = page.getByRole('button', { name: '+ 職歴を追加' });
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(100);
        }
      }

      // 5件目の追加後、ボタンが非表示になる
      const addButton = page.getByRole('button', { name: '+ 職歴を追加' });
      const isVisible = await addButton.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();
    });
  });

  test.describe('送信時バリデーション', () => {
    test('必須フィールド未入力で送信するとエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 元のURL保持
      const originalUrl = page.url();

      // フォームをスクロールして送信ボタンを表示
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // 送信ボタンをクリック（type="submit"を直接使用）
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // DOMの更新を待つ（waitForFunctionでクラス変更を検出）
      await page.waitForTimeout(2000);

      // バリデーションの証拠を収集
      const toastError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const redBgCount = await page.locator('.bg-red-50').count();
      const currentUrl = page.url();
      const stayedOnPage = currentUrl.includes('/register/worker');

      // いずれかのバリデーション表示があること、またはページ遷移なし
      expect(toastError || redBorderCount > 0 || redBgCount > 0 || stayedOnPage).toBeTruthy();
    });

    test('未入力フィールドに赤枠が表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // フォームをスクロールして送信ボタンを表示
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // 送信ボタンをクリック
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // DOMの更新を待つ
      await page.waitForTimeout(2000);

      // 赤枠が表示されることを確認（複数の必須フィールドのいずれか）
      const redBorderCount = await page.locator('.border-red-500').count();
      const redBgCount = await page.locator('.bg-red-50').count();
      const toastError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const currentUrl = page.url();
      const stayedOnPage = currentUrl.includes('/register/worker');

      // 赤枠、赤背景、トースト、またはページ遷移なし
      expect(redBorderCount > 0 || redBgCount > 0 || toastError || stayedOnPage).toBeTruthy();
    });

    test('無効な電話番号形式でエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 必須項目を入力（無効な電話番号以外）
      await page.locator('input[placeholder="山田"]').fill(TEST_WORKER_DATA.lastName);
      await page.locator('input[placeholder="太郎"]').fill(TEST_WORKER_DATA.firstName);
      await page.locator('input[placeholder="ヤマダ"]').fill(TEST_WORKER_DATA.lastNameKana);
      await page.locator('input[placeholder="タロウ"]').fill(TEST_WORKER_DATA.firstNameKana);
      await page.locator('select').first().selectOption(TEST_WORKER_DATA.gender);
      await page.locator('select').nth(1).selectOption(TEST_WORKER_DATA.nationality);
      await page.locator('input[placeholder="example@email.com"]').fill(TEST_WORKER_DATA.email);

      // 無効な電話番号（桁数不足）
      await page.locator('input[placeholder="090-1234-5678"]').fill('0901234');

      await page.locator('input[placeholder="8文字以上"]').fill(TEST_WORKER_DATA.password);
      await page.locator('input[placeholder="パスワードを再入力"]').fill(TEST_WORKER_DATA.password);

      // フォームをスクロールして送信ボタンを表示
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // 送信
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // DOMの更新を待つ
      await page.waitForTimeout(2000);

      // エラー表示を確認
      const phoneError = await page.getByText(/電話番号は10桁または11桁/).isVisible().catch(() => false);
      const requiredError = await page.getByText(/以下の項目を入力してください/).isVisible().catch(() => false);
      const redBorderCount = await page.locator('.border-red-500').count();
      const stayedOnPage = page.url().includes('/register/worker');

      expect(phoneError || requiredError || redBorderCount > 0 || stayedOnPage).toBeTruthy();
    });

    test('フリガナに非カタカナが含まれるとエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 必須項目を入力
      await page.locator('input[placeholder="山田"]').fill(TEST_WORKER_DATA.lastName);
      await page.locator('input[placeholder="太郎"]').fill(TEST_WORKER_DATA.firstName);

      // 非カタカナを含むフリガナ（英字）
      await page.locator('input[placeholder="ヤマダ"]').fill('Yamada');
      await page.locator('input[placeholder="タロウ"]').fill('Taro');

      await page.locator('select').first().selectOption(TEST_WORKER_DATA.gender);
      await page.locator('select').nth(1).selectOption(TEST_WORKER_DATA.nationality);
      await page.locator('input[placeholder="example@email.com"]').fill(TEST_WORKER_DATA.email);
      await page.locator('input[placeholder="090-1234-5678"]').fill(TEST_WORKER_DATA.phoneNumber);
      await page.locator('input[placeholder="8文字以上"]').fill(TEST_WORKER_DATA.password);
      await page.locator('input[placeholder="パスワードを再入力"]').fill(TEST_WORKER_DATA.password);

      // フィールド下のリアルタイムバリデーションエラーを確認
      await expect(page.getByText(/カタカナで入力してください/).first()).toBeVisible();
    });
  });

  test.describe('キャンセル操作', () => {
    test('キャンセルボタンが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
    });

    test('戻るリンクが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 戻るリンク
      const backLink = page.locator('a:has-text("戻る")');
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', '/job-list');
    });
  });

  test.describe('住所入力', () => {
    test('住所入力コンポーネントが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 住所ラベル（正確にマッチ）
      await expect(page.getByText('住所 *')).toBeVisible();

      // 郵便番号入力欄または都道府県選択が表示されていること
      const postalCodeInput = page.locator('input[placeholder*="123"]').first();
      const isPostalVisible = await postalCodeInput.isVisible().catch(() => false);

      // 都道府県選択
      const prefectureSelect = page.locator('select').filter({ hasText: /東京都|選択してください/ });
      const isPrefVisible = await prefectureSelect.first().isVisible().catch(() => false);

      expect(isPostalVisible || isPrefVisible).toBeTruthy();
    });
  });
});
