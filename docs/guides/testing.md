# テストガイド

> **更新日**: 2025-01-07

---

## 1. テスト構成

| 種類 | ツール | 対象 |
|------|--------|------|
| E2Eテスト | Playwright | ユーザーフロー全体 |
| ユニットテスト | Jest（予定） | 個別関数・コンポーネント |

---

## 2. E2Eテスト

### 2.1 セットアップ

```bash
npx playwright install
```

### 2.2 テスト実行

```bash
# 全テスト実行
npx playwright test

# UIモードで実行（推奨）
npx playwright test --ui

# 特定のテストファイル実行
npx playwright test tests/e2e/worker/auth.spec.ts

# 特定のブラウザで実行
npx playwright test --project=chromium

# ヘッドありで実行（ブラウザ表示）
npx playwright test --headed
```

### 2.3 テストレポート

```bash
# HTMLレポート表示
npx playwright show-report
```

---

## 3. テストファイル構成

```
tests/e2e/
├── worker/                  # ワーカー向けテスト
│   ├── auth.spec.ts         # 認証
│   ├── job-search.spec.ts   # 求人検索
│   ├── application.spec.ts  # 応募
│   ├── my-jobs.spec.ts      # マイジョブ
│   └── profile.spec.ts      # プロフィール
├── facility/                # 施設管理者向けテスト
│   ├── auth.spec.ts         # 認証
│   ├── jobs.spec.ts         # 求人管理
│   └── applications.spec.ts # 応募者管理
├── notification/            # 通知テスト
└── fixtures/                # テストフィクスチャ
```

---

## 4. テストアカウント

### ワーカー

```typescript
const workerAccount = {
  email: 'test-worker@example.com',
  password: 'password123'
};
```

### 施設管理者

```typescript
const facilityAdmin = {
  email: 'test-admin@example.com',
  password: 'password123'
};
```

### システム管理者

```typescript
const systemAdmin = {
  email: 'admin@tastas.jp',
  password: 'admin123'
};
```

---

## 5. テスト作成ガイドライン

### 5.1 基本構造

```typescript
import { test, expect } from '@playwright/test';

test.describe('機能名', () => {
  test.beforeEach(async ({ page }) => {
    // 各テスト前の共通処理
  });

  test('テストケース名', async ({ page }) => {
    // Arrange（準備）
    await page.goto('/path');

    // Act（実行）
    await page.click('button');

    // Assert（検証）
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### 5.2 セレクター優先順位

1. `data-testid` 属性（推奨）
2. `role` + `name`
3. テキストコンテンツ
4. CSSセレクター（最後の手段）

```typescript
// 良い例
await page.getByTestId('submit-button').click();
await page.getByRole('button', { name: '送信' }).click();

// 避けるべき例
await page.click('.btn-primary');
```

### 5.3 ページオブジェクトパターン

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}

// テストで使用
const loginPage = new LoginPage(page);
await loginPage.login('test@example.com', 'password');
```

---

## 6. デバッグ

### 6.1 ステップ実行

```bash
npx playwright test --debug
```

### 6.2 スクリーンショット

```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### 6.3 トレース

```typescript
// playwright.config.ts
{
  trace: 'on-first-retry',
}
```

```bash
npx playwright show-trace trace.zip
```

---

## 7. CI/CD連携

### GitHub Actions

```yaml
- name: Run Playwright tests
  run: npx playwright test

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

---

## 8. 関連ドキュメント

- [開発環境セットアップ](./development.md)
- [テストレポート](../test-reports/)
