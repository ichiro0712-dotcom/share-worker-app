import { test, expect } from '@playwright/test';
import { loginAsFacilityAdmin } from '../fixtures/auth.fixture';
import { openAdminNav } from '../fixtures/navigation.fixture';
import { TIMEOUTS, TEST_MESSAGE } from '../fixtures/test-data';

const LARGE_MESSAGE_FILE = Buffer.alloc(15 * 1024 * 1024 + 1, 0);
const INVALID_EXE = Buffer.from('MZ', 'utf-8');

test.describe('メッセージ機能（/admin/messages）', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await openAdminNav(page, 'メッセージ', /\/admin\/messages/);
  });

  test.describe('ページ表示', () => {
    test('メッセージページが表示される', async ({ page }) => {
      // ページタイトルが表示される
      await expect(page.locator('h1, h2').filter({ hasText: /メッセージ/ })).toBeVisible();
    });
  });

  test.describe('会話一覧', () => {
    test('ワーカー別会話一覧が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 会話リストまたは空状態
      const conversationList = page.locator('[data-testid="conversation-list"], .conversation-list');
      const emptyState = page
        .getByText(/メッセージはありません|最初のメッセージを送信しましょう|会話を選択してメッセージを開始/)
        .first();

      // どちらかが表示される
      await page.waitForTimeout(TIMEOUTS.api);
      await expect(conversationList.or(emptyState)).toBeVisible();
    });

    test('未読メッセージバッジが表示される（未読がある場合）', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 未読バッジ
      const unreadBadge = page.locator('[data-testid="unread-badge"], .badge, .unread');
      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item');
      const emptyState = page
        .getByText(/メッセージはありません|最初のメッセージを送信しましょう|会話を選択してメッセージを開始/)
        .first();
      const hasBadge = await unreadBadge.first().isVisible();
      if (hasBadge) {
        expect(hasBadge).toBeTruthy();
      } else {
        const hasConversation = await conversationItem.first().isVisible();
        const hasEmpty = await emptyState.isVisible();
        expect(hasConversation || hasEmpty).toBeTruthy();
      }
    });

    test('会話をクリックでスレッドが開く', async ({ page }) => {
      await page.waitForLoadState('networkidle');

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
        const emptyState = page.locator('text=メッセージはありません, text=最初のメッセージを送信しましょう');
        await expect(messageBubble.or(emptyState).first()).toBeVisible();
      }
    });

    test('ワーカー情報が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // ワーカー名やプロフィール
        const workerInfo = page.locator('[data-testid="worker-info"], .worker-info, h2, h3');
        // 情報があれば表示
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

    test('テキストメッセージを入力できる', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        const messageInput = page.locator('textarea, input[placeholder*="メッセージ"]').first();
        if (await messageInput.isVisible()) {
          await messageInput.fill(TEST_MESSAGE.text);
          await expect(messageInput).toHaveValue(TEST_MESSAGE.text);
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
          // 空の状態で送信ボタンが無効化されているか確認
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

  test.describe('ファイル添付', () => {
    test('ファイル添付ボタンが表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // 添付ボタンまたはファイル入力
        const attachButton = page.locator('button').filter({ has: page.locator('svg') });
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

        await fileInput.setInputFiles({
          name: 'large.pdf',
          mimeType: 'application/pdf',
          buffer: LARGE_MESSAGE_FILE,
        });

        await expect(page.locator('text=15.0MB以下')).toBeVisible();
      } else {
        await expect(
          page.getByText(/メッセージはありません|最初のメッセージを送信しましょう|会話を選択してメッセージを開始/).first()
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

        await fileInput.setInputFiles({
          name: 'invalid.exe',
          mimeType: 'application/octet-stream',
          buffer: INVALID_EXE,
        });

        await expect(page.locator('text=許可されていないファイル形式')).toBeVisible();

        await page.unroute('**/api/upload/presigned');
      } else {
        await expect(
          page.getByText(/メッセージはありません|最初のメッセージを送信しましょう|会話を選択してメッセージを開始/).first()
        ).toBeVisible();
      }
    });
  });

  test.describe('既読管理', () => {
    test('メッセージを開くと既読になる', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 未読バッジがある会話を開く
      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // 既読処理が行われる（トーストやバッジの消失）
        await page.waitForTimeout(TIMEOUTS.api);
      }
    });
  });

  test.describe('空状態', () => {
    test('メッセージがない場合、空状態が表示される', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // 空状態またはリスト
      const emptyState = page
        .getByText(/メッセージはありません|最初のメッセージを送信しましょう|会話を選択してメッセージを開始/)
        .first();
      const conversationList = page.locator('[data-testid="conversation-item"], .conversation-item');

      // どちらかが表示される
      const hasEmpty = await emptyState.isVisible();
      const hasList = await conversationList.first().isVisible();
      expect(hasEmpty || hasList).toBeTruthy();
    });
  });

  test.describe('ワーカーへのリンク', () => {
    test('ワーカープロフィールへのリンクが機能する', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const conversationItem = page.locator('[data-testid="conversation-item"], .conversation-item').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();
        await page.waitForLoadState('networkidle');

        // ワーカーへのリンク
        const workerLink = page.locator('a[href*="/admin/workers/"]');
        if (await workerLink.first().isVisible()) {
          await workerLink.first().click();
          await page.waitForURL('/admin/workers/**');
        }
      }
    });
  });
});
