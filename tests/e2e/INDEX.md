# E2Eテストインデックス

このディレクトリには、+タスタス (看護師・介護士向け求人マッチングWebサービス) のE2Eテストが含まれています。

## 📋 目次

- [テスト実行方法](#テスト実行方法)
- [テストカテゴリ](#テストカテゴリ)
- [テストファイル一覧](#テストファイル一覧)
- [テストパターン](#テストパターン)
- [フィクスチャ](#フィクスチャ)

## 🚀 テスト実行方法

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# 特定のテストファイルを実行
npx playwright test tests/e2e/worker/auth.spec.ts

# UIモードで実行（デバッグ用）
npx playwright test --ui

# ヘッドレスモードで実行
npx playwright test --headed
```

## 📂 テストカテゴリ

### 1. ユーザー種別テスト

#### ワーカー側テスト (`worker/`)
ワーカー（求職者）側の機能テスト

- **auth.spec.ts** - 認証機能（ログイン、登録、ログアウト、パスワードリセット）
- **job-search.spec.ts** - 求人検索機能（フィルター、ソート、検索）
- **application.spec.ts** - 求人応募機能
- **my-jobs.spec.ts** - マイ求人管理（応募状況、スケジュール）
- **profile.spec.ts** - プロフィール編集
- **messages.spec.ts** - メッセージ機能
- **reviews.spec.ts** - レビュー機能

#### 施設管理者テスト (`facility/`)
施設管理者側の機能テスト

- **auth.spec.ts** - 認証機能（ログイン、ログアウト）
- **jobs.spec.ts** - 求人管理（作成、編集、削除、公開・非公開）
- **applications.spec.ts** - 応募管理（承認、拒否、キャンセル）
- **workers.spec.ts** - ワーカー管理
- **facility-settings.spec.ts** - 施設情報設定
- **messages.spec.ts** - メッセージ機能

### 2. 機能別テスト

#### バグ修正検証 (`fix/`)
特定のバグ修正の検証テスト

- **message-unread-badge.spec.ts** - 未読バッジ表示修正
- **admin-jobs-sort.spec.ts** - 管理画面求人ソート修正
- **admin-applications-sort.spec.ts** - 管理画面応募ソート修正
- **working-hours-calc.spec.ts** - 実働時間計算修正

#### 2026年1月修正検証 (`fixes-2026-01/`)
2026年1月にリリースされた修正の検証

- **display-text.spec.ts** - 表示テキスト修正
- **email-triggers.spec.ts** - メール送信トリガー修正
- **features.spec.ts** - 新機能追加検証
- **form-validation.spec.ts** - フォームバリデーション修正
- **navigation.spec.ts** - ナビゲーション修正
- **ui-layout.spec.ts** - UIレイアウト修正

#### 修正検証 (`verify-fixes/`)
デバッグシートに基づく修正検証

- **id-4-message-screen.spec.ts** - ID-4: メッセージ画面エラー修正
- **id-49-cache-refresh.spec.ts** - ID-49: キャッシュリフレッシュ問題修正
- **id-66-skeleton-ui.spec.ts** - ID-66: スケルトンUI表示修正
- **reproduction-check.spec.ts** - 既知バグの再現チェック
- **display-fixes.spec.ts** - 表示関連修正
- **form-validation-fixes.spec.ts** - フォームバリデーション修正
- **job-application-fixes.spec.ts** - 求人応募関連修正
- **setup-test-data.spec.ts** - テストデータセットアップ
- **upload-fixes.spec.ts** - ファイルアップロード修正

### 3. シナリオテスト (`scenarios/`)
エンドツーエンドの業務フローテスト

- **normal-scenarios.spec.ts** - 正常シナリオ（ハッピーパス）
- **semi-normal-scenarios.spec.ts** - 準正常シナリオ
- **abnormal-scenarios.spec.ts** - 異常系シナリオ
- **integration-flows.spec.ts** - 統合フロー
- **debug-checklist.spec.ts** - デバッグチェックリスト
- **run-all-with-report.spec.ts** - 全テスト実行＋レポート生成

### 4. 機能テスト

#### 通知機能 (`notification/`)
- **notification-settings.spec.ts** - 通知設定機能
- **notification-timing.spec.ts** - 通知タイミング

#### APIテスト (`api/`)
- **push-notification.spec.ts** - プッシュ通知API

#### フロー統合 (`flows/`)
- **job-approval-flow.spec.ts** - 求人承認フロー

#### 安定性テスト (`stability/`)
- **job-search-stability.spec.ts** - 求人検索の安定性

### 5. ルートレベルテスト
汎用的な機能テスト

- **worker-registration.spec.ts** - ワーカー新規登録
- **job-creation.spec.ts** - 求人作成
- **labor-document.spec.ts** - 労働関連書類
- **file-upload-validation.spec.ts** - ファイルアップロードバリデーション
- **manual-screenshots.spec.ts** - スクリーンショット取得（マニュアル用）

### 6. フィクスチャ (`fixtures/`)
テストで使用する共通機能

- **auth.fixture.ts** - 認証関連ヘルパー
- **test-data.ts** - テストデータ定数
- **test-accounts.ts** - テストアカウント管理
- **test-reporter.ts** - テストレポート生成
- **login-check.spec.ts** - ログイン状態確認

## 📊 テストパターン

### 正常系テスト
期待通りの入力で期待通りの結果が得られることを確認

- ログイン → 各機能の基本操作 → ログアウト
- フォーム入力 → 送信 → 成功メッセージ表示
- データ作成 → 一覧表示 → 詳細表示

### 準正常系テスト
想定の範囲内だが通常とは異なる操作

- 大量データの表示
- 特殊文字入力
- 境界値入力

### 異常系テスト
エラーハンドリングの確認

- 必須項目未入力
- 不正な形式の入力
- 権限のない操作
- ネットワークエラー

### バグ修正検証テスト
特定のバグIDに対する修正の検証

- 再現手順の実行
- 修正前の動作確認
- 修正後の動作確認
- エッジケースのテスト

## 🎯 テストカバレッジ

### ワーカー側機能
- ✅ 認証（ログイン、登録、パスワードリセット）
- ✅ 求人検索・閲覧
- ✅ 求人応募
- ✅ マイページ（プロフィール、スケジュール）
- ✅ メッセージ送受信
- ✅ レビュー機能

### 施設管理者側機能
- ✅ 認証（ログイン、ログアウト）
- ✅ 求人管理（CRUD操作）
- ✅ 応募管理（承認、拒否）
- ✅ ワーカー管理
- ✅ 施設情報設定
- ✅ メッセージ送受信

### システム機能
- ✅ 通知機能（プッシュ通知、メール通知）
- ✅ ファイルアップロード
- ✅ データバリデーション
- ✅ エラーハンドリング

## 🔧 フィクスチャとヘルパー

### 認証ヘルパー (`fixtures/auth.fixture.ts`)
```typescript
- loginAsWorker(page) - ワーカーとしてログイン
- loginAsFacilityAdmin(page) - 施設管理者としてログイン
- loginAsSystemAdmin(page) - システム管理者としてログイン
- logoutAsWorker(page) - ワーカーとしてログアウト
- testKatakanaOnlyValidation() - カタカナバリデーションテスト
- hasErrorBorder() - エラー表示確認
- waitForToast() - トースト通知待機
```

### テストデータ (`fixtures/test-data.ts`)
```typescript
- TIMEOUTS - タイムアウト設定
- INVALID_INPUT_DATA - 不正入力データ
- VALID_INPUT_DATA - 正常入力データ
- TEST_ACCOUNTS - テストアカウント情報
```

### テストアカウント (`fixtures/test-accounts.ts`)
```typescript
- saveTestAccounts() - テストアカウント保存
- loadTestAccounts() - テストアカウント読み込み
```

## 📝 テスト作成ガイドライン

### 新しいテストファイルを作成する場合

1. **適切なディレクトリに配置**
   - ユーザー種別: `worker/`, `facility/`
   - 機能別: `fix/`, `verify-fixes/`, `scenarios/`

2. **命名規則**
   - 機能名.spec.ts（例: `auth.spec.ts`）
   - バグID.spec.ts（例: `id-49-cache-refresh.spec.ts`）

3. **テスト構造**
   ```typescript
   import { test, expect } from '@playwright/test';
   import { loginAsWorker } from '../fixtures/auth.fixture';

   test.describe('機能名', () => {
     test.beforeEach(async ({ page }) => {
       // 事前準備
     });

     test('正常系: 説明', async ({ page }) => {
       // テストケース
     });

     test('異常系: 説明', async ({ page }) => {
       // テストケース
     });
   });
   ```

4. **コメント**
   - デバッグシートIDを記載（該当する場合）
   - 修正内容の簡潔な説明
   - テストの目的

5. **アサーション**
   - 明確なエラーメッセージ
   - 適切なタイムアウト設定
   - 安定した要素セレクター

## 🐛 デバッグシートIDとテストの対応

| デバッグシートID | テストファイル | 内容 |
|----------------|---------------|------|
| #4 | id-4-message-screen.spec.ts | メッセージ画面エラー |
| #49 | id-49-cache-refresh.spec.ts | キャッシュリフレッシュ |
| #66 | id-66-skeleton-ui.spec.ts | スケルトンUI表示 |
| #24 | form-validation.spec.ts | パスワード8文字統一 |
| #38 | form-validation.spec.ts | メール二重入力確認 |
| #48 | form-validation.spec.ts | 実働時間自動計算 |
| #7 | form-validation.spec.ts | 時給コンマ表示 |
| #15 | form-validation.spec.ts | 休憩時間バリデーション |

詳細は各テストファイル内のコメントを参照してください。

## 🔄 継続的インテグレーション

テストはGitHub ActionsまたはVercelのデプロイメントプロセスで自動実行されます。

```yaml
# .github/workflows/playwright.yml で設定
- プルリクエスト作成時
- mainブランチへのマージ時
- 定期実行（毎日）
```

## 📚 参考資料

- [Playwright Documentation](https://playwright.dev/)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
- プロジェクトドキュメント: `/docs/`

---

**最終更新**: 2026-01-25
**メンテナー**: Development Team
