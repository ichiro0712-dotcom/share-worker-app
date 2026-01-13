# デプロイガイド

> **更新日**: 2025-01-07

---

## 1. 環境構成

| 環境 | URL | ブランチ | 用途 |
|------|-----|----------|------|
| 本番 | https://share-worker-app.vercel.app | main | 本番環境 |
| ステージング | https://stg-share-worker.vercel.app | develop | 検証環境 |
| 開発 | http://localhost:3000 | - | ローカル開発 |

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
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="production-secret"
NEXTAUTH_URL="https://share-worker-app.vercel.app"

# System Admin
SYSTEM_ADMIN_SESSION_SECRET="32文字以上のランダム文字列"

# AWS S3
AWS_ACCESS_KEY_ID="xxx"
AWS_SECRET_ACCESS_KEY="xxx"
AWS_REGION="ap-northeast-1"
AWS_S3_BUCKET_NAME="xxx"

# VAPID
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
- **Netlify/Supabaseは使用禁止**

### 7.2 推奨事項

- 大きな変更は段階的にデプロイ
- デプロイ前にステージング環境で確認
- DBスキーマ変更は慎重に

---

## 8. 関連ドキュメント

- [開発環境セットアップ](./development.md)
- [システム設計書](../specifications/system-design.md)
