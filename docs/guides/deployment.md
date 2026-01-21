# デプロイガイド

> **更新日**: 2026-01-17

---

## 1. 環境構成

### 1.1 Webサーバー

| 環境 | URL | ブランチ | 用途 |
|------|-----|----------|------|
| 本番 | https://tastas.work | main | 本番環境 |
| ステージング | https://stg-share-worker.vercel.app | develop | 検証環境 |
| 開発 | http://localhost:3000 | - | ローカル開発 |

### 1.2 Supabaseプロジェクト（DB/Storage）

| プロジェクトID | 用途 | 備考 |
|---------------|------|------|
| `ryvyuxomiqcgkspmpltk` | **本番** | .env.production で使用 |
| `qcovuuqxyihbpjlgccxz` | **ステージング** | .env.local で使用 |
| `ziaunavcbawzorrwwnos` | **ステージングDB/Storage（旧）** | 既存画像データが参照中のため維持 |

**注意:**
- 本番DBの画像URLは複数のSupabaseプロジェクトを参照している（移行履歴による）
- 新規アップロードは環境変数 `NEXT_PUBLIC_SUPABASE_URL` で指定されたプロジェクトに保存される

---

## 2. デプロイフロー

### 2.1 自動デプロイ

GitHubへのプッシュで自動的にVercelにデプロイされる。

```
feature/xxx → develop → ステージング環境
develop → main → 本番環境
```

### 2.2 手動デプロイ

Vercelダッシュボードから手動でデプロイ可能。

---

## 3. デプロイ前チェックリスト

### 3.1 ローカル確認

```bash
# TypeScriptエラーチェック
npm run build

# Lintエラーチェック
npm run lint

# E2Eテスト（必要に応じて）
npx playwright test
```

### 3.2 環境変数確認

本番環境の環境変数が正しく設定されているか確認：

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `AWS_*`（S3関連）
- `VAPID_*`（プッシュ通知関連）
- `SYSTEM_ADMIN_SESSION_SECRET`

### 3.3 DBマイグレーション

スキーマ変更がある場合：

```bash
npx prisma db push
```

---

## 4. 本番環境の環境変数

### 4.1 必須設定

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres.[project-id]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-id]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="xxx"
SUPABASE_S3_ACCESS_KEY_ID="xxx"
SUPABASE_S3_SECRET_ACCESS_KEY="xxx"

# NextAuth
NEXTAUTH_SECRET="production-secret"
NEXTAUTH_URL="https://tastas.work"
NEXT_PUBLIC_APP_URL="https://tastas.work"

# System Admin
SYSTEM_ADMIN_SESSION_SECRET="32文字以上のランダム文字列"

# メール送信 (Resend)
RESEND_API_KEY="xxx"
RESEND_FROM_EMAIL="noreply@tastas.jp"

# VAPID (プッシュ通知)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="xxx"
VAPID_PRIVATE_KEY="xxx"
VAPID_SUBJECT="mailto:support@tastas.jp"
```

### 4.2 シークレット生成

```bash
openssl rand -base64 32
```

---

## 5. デプロイ後確認

### 5.1 基本動作確認

- [ ] トップページが表示される
- [ ] ワーカーログインができる
- [ ] 施設管理者ログインができる
- [ ] System Adminログインができる

### 5.2 主要機能確認

- [ ] 求人検索・一覧表示
- [ ] 求人詳細表示
- [ ] 応募機能
- [ ] メッセージ機能
- [ ] 画像アップロード

---

## 6. ロールバック

### 6.1 Vercelダッシュボードから

1. Vercelダッシュボードにアクセス
2. Deploymentsタブを開く
3. 以前の正常なデプロイを選択
4. 「Promote to Production」をクリック

### 6.2 Gitから

```bash
git revert HEAD
git push origin main
```

---

## 7. 注意事項

### 7.1 禁止事項

- **mainブランチへの直接push禁止**
- **developを経由せずmainへのPR作成禁止**
- **Netlifyは使用禁止**（Vercelのみ使用）

### 7.2 推奨事項

- 大きな変更は段階的にデプロイ
- デプロイ前にステージング環境で確認
- DBスキーマ変更は慎重に

---

## 8. 関連ドキュメント

- [開発環境セットアップ](./development.md)
- [システム設計書](../specifications/system-design.md)
