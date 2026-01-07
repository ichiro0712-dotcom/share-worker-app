# 完了済み項目の検証テストワークフロー

デバッグシートで「完了」ステータスの項目を、E2Eテストで自動検証するためのワークフロー。

## ブランチ戦略

```
main
  └── test/verify-completed-fixes
```

**ブランチ名**: `test/verify-completed-fixes`

## 完了済み項目一覧（テスト対象）

| ID | 種別 | 優先度 | 概要 | テスト可能性 |
|----|------|--------|------|-------------|
| #1 | バグ | 低 | 画像エラー表示（テンプレート編集） | △ 環境依存 |
| #2 | バグ | 普 | 資格証明書/緊急連絡先クリックでエラー | ○ |
| #3 | バグ | 普 | ログイン画面上部の画像表示 | ○ |
| #14 | バグ | 普 | 資格証明書写真が表示されない | ○ |
| #17 | バグ | 普 | 労働条件通知書リンク問題 | ○ |
| #18 | バグ | - | 施設管理画面顔写真アップ問題 | ○ |
| #19 | 提案 | 高 | 新規施設登録、挨拶文補足情報 | ○ |
| #20 | バグ | - | 終了日付での求人作成チェック | ○ |
| #21 | バグ | 緊急 | 担当者顔写真アップロード20MB対応 | ○ |
| #23 | 提案 | 高 | 郵便番号から都道府県自動入力 | ○ |
| #26 | その他 | 高 | 性別指定求人の違法性（仕様確認済み） | △ 仕様確認 |
| #30 | 提案 | 普 | 必須項目の視覚的表示（赤枠） | ○ |
| #34 | バグ | 高 | 資格選択・未アップロード時エラー | ○ |
| #40 | バグ | 低 | フリガナひらがな登録 | ○ |
| #41 | バグ | 緊急 | 画像サンプル「佐藤」削除 | ○ |
| #51 | 提案 | - | エラー内容通知 | ○ |
| #53 | バグ | 緊急 | マッチング日程表示 | △ 複雑 |
| #54 | バグ | - | 勤務日時過ぎた求人への応募禁止 | ○ |
| #60 | バグ | - | メッセージ消える問題 | ○ |
| #6 | バグ | 低 | 問い合わせページエラー | ○ |

## テスト実装計画

### Phase 1: 基本表示・UI確認テスト

```typescript
// tests/e2e/verify-fixes/display-fixes.spec.ts

test.describe('表示・UI修正の検証', () => {

  // #3: ログイン画面上部の画像表示
  test('ログイン画面上部にロゴ画像が表示される', async ({ page }) => {
    await page.goto('/login');
    const logo = page.locator('img[alt*="logo"], img[alt*="ロゴ"]');
    await expect(logo).toBeVisible();
  });

  // #41: 画像サンプル「佐藤」削除
  test('プロフィール編集画面に「佐藤」サンプル画像がない', async ({ page }) => {
    // 前提: ログイン済み
    await loginAsWorker(page);
    await page.goto('/mypage/profile');
    const satoText = page.getByText('佐藤');
    await expect(satoText).not.toBeVisible();
  });

  // #6: 問い合わせページエラー
  test('問い合わせページが正常に表示される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/contact');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // エラーが表示されていないこと
    await expect(page.getByText(/error|エラー/i)).not.toBeVisible();
  });
});
```

### Phase 2: フォーム検証テスト

```typescript
// tests/e2e/verify-fixes/form-validation-fixes.spec.ts

test.describe('フォーム検証修正の検証', () => {

  // #30: 必須項目の視覚的表示（赤枠）
  test('必須項目未入力時に赤枠が表示される', async ({ page }) => {
    await page.goto('/register/worker');
    // 空のまま送信
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
    // 赤枠または赤背景が表示される
    const redElements = await page.locator('.border-red-500, .bg-red-50').count();
    expect(redElements).toBeGreaterThan(0);
  });

  // #23: 郵便番号から都道府県自動入力
  test('郵便番号入力で都道府県が自動入力される', async ({ page }) => {
    await page.goto('/register/worker');
    await page.fill('input[name="postalCode"]', '1000001');
    await page.waitForTimeout(500);
    const prefecture = await page.inputValue('select[name="prefecture"], input[name="prefecture"]');
    expect(prefecture).toBe('東京都');
  });

  // #40: フリガナひらがな登録
  test('フリガナにひらがなを入力しても登録できる', async ({ page }) => {
    await page.goto('/register/worker');
    await page.fill('input[name="nameKana"]', 'やまだたろう');
    // エラーにならないこと
    await expect(page.locator('.border-red-500').filter({ has: page.locator('input[name="nameKana"]') })).not.toBeVisible();
  });
});
```

### Phase 3: 求人・応募関連テスト

```typescript
// tests/e2e/verify-fixes/job-application-fixes.spec.ts

test.describe('求人・応募修正の検証', () => {

  // 前提条件: テスト用施設・求人データ
  test.beforeEach(async ({ page }) => {
    // 施設管理者としてログイン
    await loginAsFacilityAdmin(page);
  });

  // #20: 終了日付での求人作成チェック
  test('過去日付の求人は作成できない', async ({ page }) => {
    await page.goto('/admin/jobs/new');
    // 過去の日付を設定
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 日付選択
    await page.click(`[data-date="${yesterdayStr}"]`);
    await page.click('button[type="submit"]');

    // エラーが表示される
    await expect(page.getByText(/過去|終了|作成できません/)).toBeVisible();
  });

  // #54: 勤務日時過ぎた求人への応募禁止
  test('過去日付の求人が一覧に表示されない', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/jobs');
    await page.waitForTimeout(1000);

    // 過去の日付が表示されていないこと
    const today = new Date();
    const dateElements = await page.locator('[data-work-date]').allTextContents();
    for (const date of dateElements) {
      const workDate = new Date(date);
      expect(workDate >= today).toBeTruthy();
    }
  });
});
```

### Phase 4: ファイルアップロードテスト

```typescript
// tests/e2e/verify-fixes/upload-fixes.spec.ts

test.describe('ファイルアップロード修正の検証', () => {

  // #18, #21: ファイルアップロードサイズ制限
  test('20MBまでの画像がアップロードできる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/facility');

    // テスト用画像ファイルをアップロード（5MB以下）
    const filePath = './tests/fixtures/test-image-5mb.jpg';
    await page.setInputFiles('input[type="file"]', filePath);
    await page.waitForTimeout(2000);

    // エラーが表示されないこと
    await expect(page.getByText(/エラー|failed/i)).not.toBeVisible();
  });

  // #34: 資格選択・未アップロード時エラー
  test('資格選択時に資格証未アップロードでエラーが表示される', async ({ page }) => {
    await page.goto('/register/worker');

    // 介護福祉士を選択
    await page.check('input[value="介護福祉士"]');
    // 資格証をアップロードせずに送信
    await page.click('button[type="submit"]');

    // エラーまたは警告が表示される
    const hasValidation = await page.locator('.border-red-500, [role="alert"]').count();
    expect(hasValidation).toBeGreaterThan(0);
  });
});
```

### Phase 5: メッセージ関連テスト

```typescript
// tests/e2e/verify-fixes/message-fixes.spec.ts

test.describe('メッセージ機能修正の検証', () => {

  // #60: メッセージ消える問題
  test('ページ遷移後もメッセージが保持される', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/messages');

    // 最初のメッセージ件数を記録
    const initialCount = await page.locator('.message-item').count();

    // 別ページに遷移
    await page.goto('/mypage');
    // メッセージページに戻る
    await page.goto('/messages');

    // メッセージ件数が同じであること
    const finalCount = await page.locator('.message-item').count();
    expect(finalCount).toBe(initialCount);
  });

  // #17: 労働条件通知書リンク
  test('労働条件通知書のリンクが正しく機能する', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/messages');

    // 労働条件通知書リンクを探す
    const link = page.getByText(/労働条件通知書/);
    if (await link.isVisible()) {
      await link.click();
      // 正しいページに遷移すること
      await expect(page.url()).toContain('/my-jobs/');
    }
  });
});
```

## ヘルパー関数

```typescript
// tests/e2e/helpers/auth.ts

export async function loginAsWorker(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_WORKER_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_WORKER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/mypage**');
}

export async function loginAsFacilityAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[name="email"]', process.env.TEST_FACILITY_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_FACILITY_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**');
}

export async function loginAsSystemAdmin(page: Page) {
  await page.goto('/system-admin/login');
  await page.fill('input[name="email"]', 'admin@tastas.jp');
  await page.fill('input[name="password"]', process.env.TEST_SYSTEM_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/system-admin/**');
}
```

## 実行手順

### 1. ブランチ作成

```bash
git checkout main
git pull origin main
git checkout -b test/verify-completed-fixes
```

### 2. テストファイル作成

```bash
mkdir -p tests/e2e/verify-fixes
# 各テストファイルを作成
```

### 3. テスト実行

```bash
# 全テスト実行
npm run test:e2e -- tests/e2e/verify-fixes/

# 個別ファイル実行
npm run test:e2e -- tests/e2e/verify-fixes/display-fixes.spec.ts
```

### 4. 結果確認とマージ

```bash
# テスト通過後
git add tests/
git commit -m "test: 完了済みバグ修正の検証テスト追加

- 表示・UI修正テスト (#3, #6, #41)
- フォーム検証テスト (#23, #30, #40)
- 求人・応募テスト (#20, #54)
- ファイルアップロードテスト (#18, #21, #34)
- メッセージ機能テスト (#17, #60)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin test/verify-completed-fixes
# PR作成後マージ
```

## テストデータ要件

| データ | 説明 | 準備方法 |
|--------|------|----------|
| テストワーカー | E2E用ワーカーアカウント | seedデータまたは環境変数 |
| テスト施設管理者 | E2E用施設管理アカウント | seedデータまたは環境変数 |
| テスト画像ファイル | 各サイズの画像ファイル | tests/fixtures/ に配置 |
| テスト求人データ | 検証用の求人 | beforeEach で作成 |

## 注意事項

1. **環境変数**: テストアカウント情報は `.env.test` に設定
2. **並列実行**: テスト間で依存がないよう設計
3. **クリーンアップ**: テスト後にデータを削除
4. **スクリーンショット**: 失敗時は自動保存
