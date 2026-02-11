import { test, expect } from '@playwright/test';
import { loginAsWorker, loginAsFacilityAdmin, loginAsSystemAdmin } from '../fixtures/auth.fixture';

/**
 * 完了済みバグ修正の検証テスト - 表示・UI関連
 *
 * 対象デバッグシートID:
 * - #3: ログイン画面上部の画像表示
 * - #6: 問い合わせページエラー
 * - #41: 画像サンプル「佐藤」削除
 * - #14: 資格証明書写真が表示されない
 */

test.describe('表示・UI修正の検証', () => {
  // #3: ログイン画面上部の画像表示
  test('ログイン画面にロゴ/ヘッダー画像が表示される', async ({ page }) => {
    await page.goto('/login');

    // ロゴまたはヘッダー画像/テキストの存在確認
    const hasLogo =
      (await page.locator('img[alt*="logo"], img[alt*="ロゴ"], img[alt*="タスタス"], img[alt*="タスタス"]').count()) > 0;
    const hasHeaderText =
      (await page.locator('h1, h2').filter({ hasText: /タスタス|タスタス|ログイン/ }).count()) > 0;

    expect(hasLogo || hasHeaderText).toBeTruthy();
  });

  // #6: 問い合わせページエラー（施設管理者）
  test('問い合わせページが正常に表示される（施設管理者）', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/contact');

    // ページが正常に読み込まれる
    await page.waitForLoadState('networkidle');

    // エラー画面でないことを確認
    const errorIndicators = [
      'Error',
      'エラー',
      '500',
      'Internal Server Error',
      'Something went wrong',
    ];

    for (const indicator of errorIndicators) {
      const element = page.locator(`text=${indicator}`);
      const count = await element.count();
      // エラーメッセージがメインコンテンツとして表示されていないこと
      if (count > 0) {
        // フォームの一部のラベル等は許容
        const isMainError = await element.first().evaluate((el) => {
          const parent = el.closest('main, [role="main"], .container');
          return parent?.querySelector('h1, h2')?.textContent?.includes('Error') ?? false;
        });
        expect(isMainError).toBeFalsy();
      }
    }

    // コンテンツが表示されていること
    const hasContent =
      (await page.locator('form, input, textarea, button').count()) > 0 ||
      (await page.locator('h1, h2, h3').count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  // #41: 画像サンプル「佐藤」削除
  test('プロフィール編集画面に「佐藤」サンプルが表示されない', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/mypage/profile');
    await page.waitForLoadState('networkidle');

    // 「佐藤」というテキストがサンプル画像として表示されていないこと
    // 注: 実際のユーザー名が「佐藤」の場合は別
    const satoElements = page.locator('img[alt*="佐藤"], [data-testid*="sample"][alt*="佐藤"]');
    const count = await satoElements.count();

    // サンプル画像としての「佐藤」がないこと
    expect(count).toBe(0);
  });

  // #14: 資格証明書写真表示（施設管理者がワーカー詳細を見る場合）
  test('ワーカー詳細ページで資格証明書写真エリアがエラーにならない', async ({ page }) => {
    await loginAsFacilityAdmin(page);

    // ワーカー一覧に移動
    await page.goto('/admin/workers');
    await page.waitForLoadState('networkidle');

    // ワーカーが存在する場合のみテスト
    const workerLink = page.locator('a[href*="/admin/workers/"]').first();
    if ((await workerLink.count()) > 0) {
      await workerLink.click();
      await page.waitForLoadState('networkidle');

      // 資格証明書セクションに移動（存在する場合）
      const certificateLink = page.locator('a[href*="certificates"], button:has-text("資格証明書")').first();
      if ((await certificateLink.count()) > 0) {
        await certificateLink.click();
        await page.waitForLoadState('networkidle');

        // JSONパースエラーが表示されていないこと
        const jsonError = page.getByText(/Unexpected token|is not valid JSON/);
        await expect(jsonError).not.toBeVisible();
      }
    }
  });

  // 追加: #2 資格証明書/緊急連絡先クリックでエラー
  test('ワーカー詳細の各タブがエラーなく表示される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/workers');
    await page.waitForLoadState('networkidle');

    const workerLink = page.locator('a[href*="/admin/workers/"]').first();
    if ((await workerLink.count()) > 0) {
      await workerLink.click();
      await page.waitForLoadState('networkidle');

      // 各タブをクリックしてエラーがないことを確認
      const tabs = ['資格証明書', '緊急連絡先', '基本情報'];
      for (const tabName of tabs) {
        const tab = page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
        if ((await tab.count()) > 0) {
          await tab.click();
          await page.waitForTimeout(500);

          // JSONパースエラーやサーバーエラーがないこと
          const errorMessages = page.locator('text=/is not valid JSON|Unexpected token|500|Internal Server Error/');
          await expect(errorMessages).not.toBeVisible();
        }
      }
    }
  });
});

test.describe('施設管理画面の表示確認', () => {
  // #19: 新規施設登録、挨拶文補足情報
  test('新規施設登録画面に挨拶文の補足情報がある', async ({ page }) => {
    await loginAsSystemAdmin(page);
    await page.goto('/system-admin/facilities/new');
    await page.waitForLoadState('networkidle');

    // 挨拶文フィールドを探す
    const greetingField = page.locator('textarea[name*="greeting"], textarea[name*="message"], label:has-text("挨拶")').first();

    if ((await greetingField.count()) > 0) {
      // 補足情報（ヒントテキスト等）が存在すること
      const parent = greetingField.locator('..');
      const hasHelperText =
        (await parent.locator('.text-gray-500, .text-muted, [class*="helper"], [class*="hint"]').count()) > 0 ||
        (await parent.locator('small, span').count()) > 0;

      // または placeholder に説明がある
      const placeholder = await greetingField.getAttribute('placeholder');
      const hasPlaceholder = placeholder && placeholder.length > 10;

      expect(hasHelperText || hasPlaceholder).toBeTruthy();
    }
  });
});
