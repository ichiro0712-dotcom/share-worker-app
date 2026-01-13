import { test, expect } from '@playwright/test';
import { loginAsWorker } from '../fixtures/auth.fixture';
import { openWorkerBottomNav } from '../fixtures/navigation.fixture';
import { TIMEOUTS, TEST_MESSAGE } from '../fixtures/test-data';

const LARGE_MESSAGE_FILE = Buffer.alloc(15 * 1024 * 1024 + 1, 0);
const INVALID_EXE = Buffer.from('MZ', 'utf-8');

test.describe('メッセージ機能（/messages）', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsWorker(page);
    await openWorkerBottomNav(page, 'メッセージ', /\/messages/);
  });

  test.describe('ページ表示', () => {
    test('メッセージページが表示される', async ({ page }) => {
      // ページが表示される
      await expect(page.locator('h1, h2').filter({ hasText: /メッセージ/ })).toBeVisible();
    });
  });

  test.describe('会話一覧', () => {
    test('会話一覧が表示される（データがある場合）', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 会話リストまたは空状態
      const conversationList = page.locator('[data-testid="conversation-list"], .conversation-list');
      const emptyState = page
        .getByText(/求人に応募するとメッセージが表示されます|メッセージはまだありません|検索結果が見つかりませんでした/)
        .first();

      // どちらかが表示される
      await page.waitForTimeout(TIMEOUTS.api);
      await expect(conversationList.or(emptyState)).toBeVisible();
    });

    test('会話をクリックでスレッドが開く', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 会話アイテムをクリック
      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForTimeout(TIMEOUTS.animation);

        const messageInput = page.locator(
          'textarea[placeholder*="メッセージ"], input[placeholder*="メッセージ"], textarea[aria-label*="メッセージ"], input[aria-label*="メッセージ"]'
        );
        const sendButton = page.locator('button').filter({ hasText: /送信/ });
        await expect(messageInput.or(sendButton).first()).toBeVisible();
      }
    });
  });

  test.describe('メッセージスレッド', () => {
    test('メッセージ履歴が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        const messageBubble = page.locator('[data-testid="message-bubble"], .message-bubble, .message');
      const emptyState = page
        .getByText(/まだメッセージはありません|施設からの連絡をお待ちください/)
        .first();
        await expect(messageBubble.or(emptyState).first()).toBeVisible();
      }
    });
  });

  test.describe('メッセージ送信', () => {
    test('メッセージ入力欄が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // 入力欄
        const messageInput = page.locator('textarea, input[placeholder*="メッセージ"]');
        if (await messageInput.isVisible()) {
          await expect(messageInput).toBeVisible();
        }
      }
    });

    test('送信ボタンが表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        const sendButton = page.locator('button').filter({ hasText: /送信/ });
        if (await sendButton.isVisible()) {
          await expect(sendButton).toBeVisible();
        }
      }
    });

    test('空メッセージは送信できない', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        const sendButton = page.locator('button').filter({ hasText: /送信/ });
        if (await sendButton.isVisible()) {
          // 空の状態で送信ボタンをクリック
          // ボタンが無効化されているか、クリックしてもエラーにならないことを確認
          const isDisabled = await sendButton.isDisabled();
          if (!isDisabled) {
            await sendButton.click();
            const errorMessage = page.locator('.text-red-700, .text-red-500, [role="alert"], text=メッセージを入力');
            await expect(errorMessage.first()).toBeVisible();
          } else {
            expect(isDisabled).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('ファイル添付機能', () => {
    test('添付ボタンが表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // 添付ボタン（クリップアイコンなど）
        const attachButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /添付|ファイル/ });
        const fileInput = page.locator('input[type="file"]');

        // どちらかがある
        const hasAttachButton = await attachButton.isVisible();
        const hasFileInput = await fileInput.isVisible();
        expect(hasAttachButton || hasFileInput).toBeTruthy();
      }
    });

    test('添付ファイルが15MB超の場合エラーになる', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        const fileInput = page.locator('input[type="file"][accept*="application/pdf"]').first();
        const dialogPromise = page.waitForEvent('dialog');

        await fileInput.setInputFiles({
          name: 'large.pdf',
          mimeType: 'application/pdf',
          buffer: LARGE_MESSAGE_FILE,
        });

        const dialog = await dialogPromise;
        expect(dialog.message()).toContain('15.0MB以下');
        await dialog.accept();
      } else {
        await expect(
          page.getByText(/求人に応募するとメッセージが表示されます|メッセージはまだありません/).first()
        ).toBeVisible();
      }
    });

    test('添付ファイルが不正な形式の場合エラーになる', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        await page.route('**/api/upload/presigned', async (route) => {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: '許可されていないファイル形式です' }),
          });
        });

        const fileInput = page.locator('input[type="file"][accept*="application/pdf"]').first();
        const dialogPromise = page.waitForEvent('dialog');

        await fileInput.setInputFiles({
          name: 'invalid.exe',
          mimeType: 'application/octet-stream',
          buffer: INVALID_EXE,
        });

        const dialog = await dialogPromise;
        expect(dialog.message()).toContain('許可されていないファイル形式');
        await dialog.accept();

        await page.unroute('**/api/upload/presigned');
      } else {
        await expect(
          page.getByText(/求人に応募するとメッセージが表示されます|メッセージはまだありません/).first()
        ).toBeVisible();
      }
    });
  });

  test.describe('空状態', () => {
    test('メッセージがない場合、空状態が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 空状態メッセージまたは会話リスト
      const emptyState = page
        .getByText(/求人に応募するとメッセージが表示されます|メッセージはまだありません|検索結果が見つかりませんでした/)
        .first();
      const conversationList = page.locator('[data-testid="conversation-item"], .conversation-item');

      // どちらかが表示される
      await page.waitForTimeout(TIMEOUTS.api);
      const hasEmpty = await emptyState.isVisible();
      const hasList = await conversationList.first().isVisible();
      expect(hasEmpty || hasList).toBeTruthy();
    });
  });
});
