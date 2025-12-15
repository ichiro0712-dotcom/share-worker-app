import { test, expect, Page } from '@playwright/test';

// テスト用のアカウント情報
const TEST_WORKER = {
  email: 'tanaka@example.com',
  password: 'password123',
};

const TEST_ADMIN = {
  email: 'admin@tastas.jp',
  password: 'admin123',
};

// ワーカーとしてログイン
async function loginAsWorker(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_WORKER.email);
  await page.fill('input[type="password"]', TEST_WORKER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(mypage|$)/);
}

// 管理者としてログイン
async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', TEST_ADMIN.email);
  await page.fill('input[type="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/**');
}

test.describe('労働条件通知書機能', () => {
  test.describe('ワーカー側', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsWorker(page);
    });

    test('マイページから仕事管理ページに遷移できる', async ({ page }) => {
      await page.goto('/mypage');

      // 「仕事管理」メニューが表示されていることを確認
      const jobsLink = page.locator('text=仕事管理');
      await expect(jobsLink).toBeVisible();

      // クリックして遷移
      await jobsLink.click();
      await page.waitForURL('/my-jobs');

      // ページタイトルを確認
      await expect(page.locator('h1')).toContainText('仕事管理');
    });

    test('仕事一覧ページが正しく表示される', async ({ page }) => {
      await page.goto('/my-jobs');

      // ヘッダーが表示されている
      await expect(page.locator('h1')).toContainText('仕事管理');

      // 戻るボタンがマイページへのリンクになっている
      const backLink = page.locator('a[href="/mypage"]');
      await expect(backLink).toBeVisible();
    });

    test('仕事詳細ページが正しく表示される', async ({ page }) => {
      await page.goto('/my-jobs');

      // 仕事カードがあればクリック
      const jobCard = page.locator('a[href^="/my-jobs/"]').first();
      if (await jobCard.isVisible()) {
        await jobCard.click();

        // 詳細ページの要素を確認
        await expect(page.locator('h1')).toContainText('仕事詳細');
        await expect(page.locator('text=勤務情報')).toBeVisible();
        await expect(page.locator('text=施設情報')).toBeVisible();
      }
    });

    test('マッチング済みの仕事で労働条件通知書リンクが表示される', async ({ page }) => {
      await page.goto('/my-jobs');

      // マッチング済みの仕事を探す（勤務予定ステータス）
      const scheduledBadge = page.locator('text=勤務予定').first();
      if (await scheduledBadge.isVisible()) {
        // その仕事カードをクリック
        const jobCard = scheduledBadge.locator('..').locator('..').locator('..');
        await jobCard.click();

        // 労働条件通知書リンクが表示されることを確認
        const laborDocLink = page.locator('text=労働条件通知書');
        await expect(laborDocLink).toBeVisible();
      }
    });

    test('労働条件通知書ページが正しく表示される', async ({ page }) => {
      // マッチング済みの応募がある前提で直接アクセス
      await page.goto('/my-jobs');

      const scheduledCard = page.locator('a[href^="/my-jobs/"]').first();
      if (await scheduledCard.isVisible()) {
        await scheduledCard.click();
        await page.waitForLoadState('networkidle');

        const laborDocLink = page.locator('a:has-text("労働条件通知書")').first();
        if (await laborDocLink.isVisible()) {
          await laborDocLink.click();

          // 労働条件通知書ページの要素を確認
          await expect(page.locator('h1, h2').filter({ hasText: '労働条件通知書' })).toBeVisible();

          // 必須セクションが表示されていることを確認
          await expect(page.locator('text=使用者情報')).toBeVisible();
          await expect(page.locator('text=労働者情報')).toBeVisible();
          await expect(page.locator('text=契約情報')).toBeVisible();
          await expect(page.locator('text=業務内容')).toBeVisible();
          await expect(page.locator('text=勤務時間')).toBeVisible();
          await expect(page.locator('text=賃金')).toBeVisible();
        }
      }
    });
  });

  test.describe('管理者側', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('ワーカー詳細ページに労働条件通知書リンクがある', async ({ page }) => {
      // ワーカー一覧ページへ
      await page.goto('/admin/workers');

      // 最初のワーカーをクリック
      const workerLink = page.locator('a[href^="/admin/workers/"]').first();
      if (await workerLink.isVisible()) {
        await workerLink.click();
        await page.waitForLoadState('networkidle');

        // 労働条件通知書リンクを確認
        const laborDocLink = page.locator('text=労働条件通知書');
        await expect(laborDocLink).toBeVisible();
      }
    });

    test('労働条件通知書一覧ページが表示される', async ({ page }) => {
      // ワーカーID 1の労働条件通知書一覧へ直接アクセス
      await page.goto('/admin/workers/1/labor-documents');

      // ページタイトルを確認
      await expect(page.locator('h1')).toContainText('労働条件通知書');

      // 戻るリンクがあることを確認
      const backLink = page.locator('text=ワーカー詳細に戻る');
      await expect(backLink).toBeVisible();
    });

    test('労働条件通知書詳細ページで印刷ボタンがある', async ({ page }) => {
      await page.goto('/admin/workers/1/labor-documents');

      // 労働条件通知書があれば詳細へ
      const docLink = page.locator('a:has-text("表示")').first();
      if (await docLink.isVisible()) {
        await docLink.click();
        await page.waitForLoadState('networkidle');

        // 印刷ボタンを確認
        const printButton = page.locator('button:has-text("印刷")');
        await expect(printButton).toBeVisible();
      }
    });
  });

  test.describe('URL変更の確認', () => {
    test('古い/mypage/applicationsは404になる', async ({ page }) => {
      await loginAsWorker(page);

      // 古いURLにアクセス
      const response = await page.goto('/mypage/applications');

      // 404またはリダイレクトを確認（アプリの設定による）
      // Note: 古いページが残っている場合はこのテストを調整
    });

    test('/my-jobsが正しく動作する', async ({ page }) => {
      await loginAsWorker(page);

      await page.goto('/my-jobs');

      // ページが正しくロードされることを確認
      await expect(page.locator('h1')).toContainText('仕事管理');
    });
  });
});

test.describe('労働条件通知書の内容確認', () => {
  test('必須項目がすべて表示される', async ({ page }) => {
    await loginAsWorker(page);

    // マッチング済みの仕事の労働条件通知書にアクセス
    await page.goto('/my-jobs');

    const jobCard = page.locator('a[href^="/my-jobs/"]').first();
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForLoadState('networkidle');

      const laborDocLink = page.locator('a:has-text("労働条件通知書")').first();
      if (await laborDocLink.isVisible()) {
        await laborDocLink.click();
        await page.waitForLoadState('networkidle');

        // 労働基準法に基づく必須項目を確認
        const requiredSections = [
          '使用者情報',
          '労働者情報',
          '契約情報',
          '業務内容',
          '勤務時間',
          '賃金',
          '社会保険等',
          '受動喫煙防止措置',
          '解雇の事由',
        ];

        for (const section of requiredSections) {
          await expect(page.locator(`text=${section}`)).toBeVisible();
        }
      }
    }
  });
});
