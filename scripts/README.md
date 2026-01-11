# 開発スクリプト

開発・テスト・メンテナンス用のユーティリティスクリプト集です。

## テスト関連

### E2Eテスト実行
```bash
# 基本実行（ヘッドレス）
./scripts/run-e2e-tests.sh

# 特定のテストファイル
./scripts/run-e2e-tests.sh worker/application.spec.ts
```

### E2E + DB検証（統合実行）
```bash
# E2Eテスト実行後にDB状態を自動検証
./scripts/test-with-db-verify.sh

# 特定テスト
./scripts/test-with-db-verify.sh worker/application.spec.ts
```

### DB検証（単体）
```bash
# updated_byフィールドの設定状態を検証
npx tsx scripts/verify-updated-by.ts
```

### 統合テスト
```bash
# Server Actionsのupdated_by設定をPrisma直接呼び出しでテスト
npx tsx scripts/test-updated-by-integration.ts
```

### テストレポート生成
```bash
# Playwrightテスト結果からHTMLレポートを生成
node scripts/generate-test-report.js
```

### スクリーンショット撮影
```bash
# マニュアル用のスクリーンショットを自動撮影
npx tsx scripts/capture-manual-screenshots.ts
```

## データ管理

### テストデータクリーンアップ
```bash
# E2Eテストで作成されたテストデータを削除
npx tsx scripts/clean-test-data.ts
```

### ダミー画像クリーンアップ
```bash
# 不要なダミー画像ファイルを削除
npx tsx scripts/cleanup-dummy-images.ts
```

## 管理者関連

### 管理者パスワードハッシュ化
```bash
# 管理者パスワードをbcryptハッシュ化
npx tsx scripts/hash-admin-passwords.ts
```

### 管理者名更新
```bash
# 管理者の表示名を一括更新
npx tsx scripts/update-admin-names.ts
```

### テストパスワード更新
```bash
# テストユーザーのパスワードを更新
npx tsx scripts/update-test-passwords.ts
```

## データ移行

### Supabaseストレージ移行
```bash
# Supabaseストレージからローカル/別ストレージへ移行
npx tsx scripts/migrate-supabase-storage.ts
```

### テンプレート追加
```bash
# メッセージテンプレートをDBに追加
npx tsx scripts/add-templates.ts
```

### 施設データ修正（Python）
```bash
# 施設データの一括修正
python scripts/fix_facilities.py
```

## 注意事項

- すべてのスクリプトはプロジェクトルートから実行してください
- `.env.local`の設定が必要です
- 本番DBに対して実行する場合は十分注意してください
