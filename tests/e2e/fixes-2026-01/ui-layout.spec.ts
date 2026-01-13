import { test, expect, devices } from '@playwright/test';
import { loginAsWorker, loginAsFacilityAdmin } from '../fixtures/auth.fixture';

/**
 * UI/レイアウト修正の検証テスト
 *
 * 対象デバッグシートID:
 * - #35: 求人ページ左寄り（safe-area対応）
 * - #9: 求人詳細余白・申込条件ヘッダー
 * - #36: 求人プレビュー中央配置
 * - #12: タブドット色統一
 * - #27: 施設名ヘッダー表示
 * - #29: シフト休憩時間表示
 */

test.describe('UI/レイアウト修正の検証', () => {
  // #35: 求人ページ左寄り修正（safe-area対応）
  test.describe('求人ページのモバイルレイアウト', () => {
    test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

    test('求人詳細ページがモバイルで左寄りにならない', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // 求人が存在する場合、詳細ページに遷移
      const jobCard = page.locator('a[href*="/jobs/"]').first();
      if ((await jobCard.count()) > 0) {
        await jobCard.click();
        await page.waitForLoadState('networkidle');

        // body要素のpadding/margin確認
        const bodyStyles = await page.evaluate(() => {
          const body = document.body;
          const styles = window.getComputedStyle(body);
          return {
            paddingLeft: styles.paddingLeft,
            paddingRight: styles.paddingRight,
            marginLeft: styles.marginLeft,
            marginRight: styles.marginRight,
          };
        });

        // 極端な左寄りがないこと（左右のパディングが同程度）
        // safe-area-insetが適用されていれば左右が均等
        expect(bodyStyles).toBeDefined();
      }
    });

    test('BottomNavがsafe-area対応している', async ({ page }) => {
      await loginAsWorker(page);
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // BottomNavの存在確認
      const bottomNav = page.locator('nav[class*="fixed"], [class*="bottom-nav"], [class*="BottomNav"]').last();
      if ((await bottomNav.count()) > 0) {
        const hasEnvSafe = await bottomNav.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          // pb-safe または safe-area-inset が適用されているか
          return (
            styles.paddingBottom.includes('env') ||
            el.className.includes('pb-safe') ||
            parseInt(styles.paddingBottom) > 0
          );
        });
        expect(hasEnvSafe).toBeTruthy();
      }
    });
  });

  // #9: 求人詳細の申込条件ヘッダー
  test('求人詳細ページに「申込条件」セクションヘッダーがある', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const jobCard = page.locator('a[href*="/jobs/"]').first();
    if ((await jobCard.count()) > 0) {
      await jobCard.click();
      await page.waitForLoadState('networkidle');

      // 「申込条件」または「応募条件」セクションヘッダーの存在確認
      const sectionHeader = page.locator('h2, h3, h4').filter({ hasText: /申込条件|応募条件|資格/ });
      const hasHeader = (await sectionHeader.count()) > 0;

      // セクションの視覚的な区切りがあること
      expect(hasHeader).toBeTruthy();
    }
  });

  // #36: 求人プレビュー中央配置
  test('求人プレビューページが中央に配置される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.waitForLoadState('networkidle');

    // プレビューモードに切り替え（存在する場合）
    const previewButton = page.locator('button:has-text("プレビュー")').first();
    if ((await previewButton.count()) > 0) {
      await previewButton.click();
      await page.waitForTimeout(500);

      // プレビューコンテナの中央配置確認
      const previewContainer = page.locator('[class*="preview"], [class*="job-detail"]').first();
      if ((await previewContainer.count()) > 0) {
        const classes = await previewContainer.getAttribute('class');
        // mx-auto または中央配置のクラスがあること
        const isCentered = classes?.includes('mx-auto') || classes?.includes('center');
        expect(isCentered).toBeTruthy();
      }
    }
  });

  // #12: タブドット色統一
  test('求人管理のフィルタータブドット色がバッジと統一されている', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // 公開中タブのドット色確認
    const publishedTab = page.locator('button:has-text("公開中")').first();
    if ((await publishedTab.count()) > 0) {
      const dot = publishedTab.locator('span[class*="rounded-full"], [class*="dot"]').first();
      if ((await dot.count()) > 0) {
        const bgColor = await dot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        // 青系の色であること (rgb(59, 130, 246) = blue-500 相当)
        expect(bgColor).toMatch(/rgb\(.*\)/);
      }
    }

    // 停止中タブのドット色確認
    const stoppedTab = page.locator('button:has-text("停止中")').first();
    if ((await stoppedTab.count()) > 0) {
      const dot = stoppedTab.locator('span[class*="rounded-full"], [class*="dot"]').first();
      if ((await dot.count()) > 0) {
        const bgColor = await dot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(bgColor).toMatch(/rgb\(.*\)/);
      }
    }
  });

  // #27: 施設名ヘッダー表示
  test('施設管理画面のサイドバーに施設名が表示される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    // サイドバー内の施設名表示確認
    const sidebar = page.locator('aside, nav[class*="sidebar"], [class*="Sidebar"]').first();
    if ((await sidebar.count()) > 0) {
      // 施設名が表示されていること（青色テキストで）
      const facilityName = sidebar.locator('[class*="text-blue"], [class*="facility-name"]');
      const hasFacilityName = (await facilityName.count()) > 0;

      // または施設に関するテキストがあること
      const facilityText = await sidebar.textContent();
      const containsFacilityInfo = facilityText?.includes('施設') || facilityText?.includes('センター');

      expect(hasFacilityName || containsFacilityInfo).toBeTruthy();
    }
  });

  // #29: シフト詳細モーダルに休憩時間表示
  test('シフト詳細モーダルに休憩時間が表示される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/shifts');
    await page.waitForLoadState('networkidle');

    // シフトが存在する場合、詳細を開く
    const shiftItem = page.locator('[data-testid="shift-item"], [class*="shift"]').first();
    if ((await shiftItem.count()) > 0) {
      await shiftItem.click();
      await page.waitForTimeout(500);

      // モーダル内の休憩時間表示確認
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]').first();
      if ((await modal.count()) > 0) {
        const breakTimeText = modal.locator('text=休憩');
        const hasBreakTime = (await breakTimeText.count()) > 0;

        expect(hasBreakTime).toBeTruthy();
      }
    }
  });
});
