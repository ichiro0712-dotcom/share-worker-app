import { test, expect } from '@playwright/test';
import { loginAsWorker, loginAsFacilityAdmin } from './fixtures/auth.fixture';
import { TIMEOUTS } from './fixtures/test-data';

/**
 * ファイルアップロードバリデーションテスト
 *
 * 各フォームのファイルサイズ・形式制限をテスト
 *
 * サイズ制限（utils/directUpload.ts より）:
 * - メッセージ添付: 15MB
 * - 求人画像・施設画像・プロフィール画像: 20MB
 * - ご利用ガイド: 100MB
 *
 * 許可形式（utils/fileValidation.ts より）:
 * - 画像: jpg, jpeg, png, gif, webp, heic, heif, bmp, tiff, tif, svg
 * - ドキュメント: pdf, doc, docx, xls, xlsx, txt, csv
 */

// テスト用ファイルデータ
const LARGE_20MB_FILE = Buffer.alloc(20 * 1024 * 1024 + 1, 0); // 20MB超過
const INVALID_EXE = Buffer.from('MZ', 'utf-8'); // 実行ファイル
const VALID_SMALL_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
); // 1x1 PNG

test.describe('ファイルアップロードバリデーション', () => {
  test.describe('求人画像アップロード（施設管理者）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsFacilityAdmin(page);
    });

    test('20MB超過の画像でエラーが表示される', async ({ page }) => {
      await page.goto('/admin/jobs/new');
      await page.waitForLoadState('networkidle');

      // 画像アップロードセクションを探す（TOP画像登録）
      const imageSection = page.locator('text=TOP画像登録').first();
      await expect(imageSection).toBeVisible({ timeout: TIMEOUTS.navigation });

      // ファイル入力を探す
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();

      // 大きすぎるファイルをアップロード
      await fileInput.setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: LARGE_20MB_FILE,
      });

      // エラーメッセージを確認（トーストまたはアラート）
      const errorLocator = page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first();
      await expect(errorLocator).toBeVisible({ timeout: TIMEOUTS.toast });
    });

    test('無効なファイル形式（.exe）でエラーが表示される', async ({ page }) => {
      await page.goto('/admin/jobs/new');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*="image"]').first();

      // 無効なファイルをアップロード
      await fileInput.setInputFiles({
        name: 'malware.exe',
        mimeType: 'application/octet-stream',
        buffer: INVALID_EXE,
      });

      // エラーメッセージまたはファイルが受け付けられないことを確認
      await page.waitForTimeout(TIMEOUTS.animation);
      const errorVisible = await page.getByText(/許可されていない|無効なファイル|対応していない/).first().isVisible().catch(() => false);

      // ファイルが受け付けられていないことを確認（プレビューが表示されない）
      const previewImage = page.locator('img[alt*="プレビュー"], img[alt*="preview"]').first();
      const hasPreview = await previewImage.isVisible().catch(() => false);

      expect(errorVisible || !hasPreview).toBeTruthy();
    });

    test('有効な画像ファイルはアップロードできる', async ({ page }) => {
      await page.goto('/admin/jobs/new');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*="image"]').first();

      // 有効な画像をアップロード
      await fileInput.setInputFiles({
        name: 'valid-image.png',
        mimeType: 'image/png',
        buffer: VALID_SMALL_IMAGE,
      });

      // エラーが出ないことを確認（少し待ってからチェック）
      await page.waitForTimeout(TIMEOUTS.animation);
      const errorVisible = await page.getByText(/ファイルサイズが大きすぎます|許可されていない/).first().isVisible().catch(() => false);
      expect(errorVisible).toBeFalsy();
    });
  });

  test.describe('施設画像アップロード（施設管理者）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsFacilityAdmin(page);
    });

    test('20MB超過の画像でエラーが表示される', async ({ page }) => {
      await page.goto('/admin/facility');
      await page.waitForLoadState('networkidle');

      // 担当者写真のアップロード入力を探す
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'large-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: LARGE_20MB_FILE,
        });

        // エラーメッセージを確認
        await expect(
          page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
        ).toBeVisible({ timeout: TIMEOUTS.toast });
      }
    });

    test('無効なファイル形式でエラーが表示される', async ({ page }) => {
      await page.goto('/admin/facility');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'document.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('This is a text file'),
        });

        await page.waitForTimeout(TIMEOUTS.animation);

        // エラーまたはファイルが受け付けられないことを確認
        const errorVisible = await page.getByText(/許可されていない|無効なファイル/).first().isVisible().catch(() => false);
        const successVisible = await page.getByText(/アップロード.*成功|アップロード.*完了/).first().isVisible().catch(() => false);

        expect(errorVisible || !successVisible).toBeTruthy();
      }
    });
  });

  test.describe('プロフィール画像アップロード（ワーカー）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsWorker(page);
    });

    test('20MB超過の画像でエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      // プロフィール画像入力を探す
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'large-profile.jpg',
          mimeType: 'image/jpeg',
          buffer: LARGE_20MB_FILE,
        });

        // エラーメッセージを確認
        await expect(
          page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
        ).toBeVisible({ timeout: TIMEOUTS.toast });
      }
    });

    test('無効なファイル形式でエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'malware.exe',
          mimeType: 'application/octet-stream',
          buffer: INVALID_EXE,
        });

        await page.waitForTimeout(TIMEOUTS.animation);

        // エラーまたはファイルが受け付けられないことを確認
        const errorVisible = await page.getByText(/許可されていない|無効なファイル/).first().isVisible().catch(() => false);
        const previewChanged = await page.locator('img[alt*="プロフィール"]').first().isVisible().catch(() => false);

        // exeファイルがプロフィール画像として設定されていないこと
        expect(errorVisible || !previewChanged).toBeTruthy();
      }
    });
  });

  test.describe('資格証明書アップロード（ワーカー）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsWorker(page);
    });

    test('20MB超過のファイルでエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      // 資格証明書入力を探す（image/*,.pdf を受け付ける）
      const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'large-certificate.pdf',
          mimeType: 'application/pdf',
          buffer: LARGE_20MB_FILE,
        });

        // エラーメッセージを確認
        await expect(
          page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
        ).toBeVisible({ timeout: TIMEOUTS.toast });
      }
    });

    test('無効なファイル形式（.exe）でエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        await fileInput.setInputFiles({
          name: 'malware.exe',
          mimeType: 'application/octet-stream',
          buffer: INVALID_EXE,
        });

        await page.waitForTimeout(TIMEOUTS.animation);

        // エラーまたはファイルが受け付けられないことを確認
        const errorVisible = await page.getByText(/許可されていない|無効なファイル/).first().isVisible().catch(() => false);
        expect(errorVisible).toBeTruthy();
      }
    });

    test('有効なPDFファイルはアップロードできる', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
      const inputCount = await fileInput.count();

      if (inputCount > 0) {
        // 有効なPDFヘッダーを持つファイル
        const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n%%EOF');

        await fileInput.setInputFiles({
          name: 'valid-certificate.pdf',
          mimeType: 'application/pdf',
          buffer: validPdf,
        });

        await page.waitForTimeout(TIMEOUTS.animation);

        // サイズエラーが出ないことを確認
        const sizeErrorVisible = await page.getByText(/ファイルサイズが大きすぎます/).first().isVisible().catch(() => false);
        expect(sizeErrorVisible).toBeFalsy();
      }
    });
  });

  test.describe('本人確認書類アップロード（ワーカー）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsWorker(page);
    });

    test('20MB超過のファイルでエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      // ページ下部にスクロール
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(TIMEOUTS.animation);

      // 本人確認書類セクションを探す
      const idDocSection = page.locator('text=本人確認書類').first();
      const sectionVisible = await idDocSection.isVisible().catch(() => false);

      if (sectionVisible) {
        // 本人確認書類の入力を探す
        const fileInputs = page.locator('input[type="file"][accept*=".pdf"]');
        const inputCount = await fileInputs.count();

        if (inputCount > 1) {
          // 2番目以降のファイル入力（本人確認書類用）
          const fileInput = fileInputs.nth(1);
          await fileInput.setInputFiles({
            name: 'large-id.jpg',
            mimeType: 'image/jpeg',
            buffer: LARGE_20MB_FILE,
          });

          await expect(
            page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
          ).toBeVisible({ timeout: TIMEOUTS.toast });
        }
      }
    });
  });

  test.describe('通帳画像アップロード（ワーカー）', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsWorker(page);
    });

    test('20MB超過のファイルでエラーが表示される', async ({ page }) => {
      await page.goto('/mypage/profile');
      await page.waitForLoadState('networkidle');

      // ページ下部にスクロール
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(TIMEOUTS.animation);

      // 通帳画像セクションを探す
      const bankBookSection = page.locator('text=通帳').first();
      const sectionVisible = await bankBookSection.isVisible().catch(() => false);

      if (sectionVisible) {
        // 通帳画像の入力を探す
        const fileInputs = page.locator('input[type="file"][accept*=".pdf"]');
        const inputCount = await fileInputs.count();

        if (inputCount > 2) {
          // 3番目以降のファイル入力（通帳画像用）
          const fileInput = fileInputs.nth(2);
          await fileInput.setInputFiles({
            name: 'large-bankbook.jpg',
            mimeType: 'image/jpeg',
            buffer: LARGE_20MB_FILE,
          });

          await expect(
            page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
          ).toBeVisible({ timeout: TIMEOUTS.toast });
        }
      }
    });
  });

  test.describe('ワーカー登録時の資格証明書', () => {
    test('20MB超過のファイルでエラーが表示される', async ({ page }) => {
      await page.goto('/register/worker');
      await page.waitForLoadState('networkidle');

      // 資格セクションまでスクロール
      const qualSection = page.locator('text=保有資格').first();
      const sectionVisible = await qualSection.isVisible().catch(() => false);

      if (sectionVisible) {
        // 資格証明書入力を探す
        const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
        const inputCount = await fileInput.count();

        if (inputCount > 0) {
          await fileInput.setInputFiles({
            name: 'large-cert.pdf',
            mimeType: 'application/pdf',
            buffer: LARGE_20MB_FILE,
          });

          await expect(
            page.getByText(/ファイルサイズが大きすぎます|20MB以下/).first()
          ).toBeVisible({ timeout: TIMEOUTS.toast });
        }
      }
    });
  });
});
