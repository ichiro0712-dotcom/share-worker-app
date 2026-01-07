# 開発環境セットアップガイド

> **更新日**: 2025-01-07

---

## 1. 必要な環境

| 項目 | バージョン |
|------|-----------|
| Node.js | 18以上 |
| npm | 9以上 |
| Docker | 最新版 |
| PostgreSQL | 15（Docker経由） |

---

## 2. 初期セットアップ

### 2.1 リポジトリのクローン

```bash
git clone https://github.com/ichiro0712-dotcom/share-worker-app.git
cd share-worker-app
```

### 2.2 依存関係のインストール

```bash
npm install
```

### 2.3 環境変数の設定

`.env.local` ファイルを作成：

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/share_worker_db?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/share_worker_db?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AWS S3（画像アップロード用）
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="ap-northeast-1"
AWS_S3_BUCKET_NAME="your-bucket-name"

# VAPID Keys（プッシュ通知用）
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key"
VAPID_PRIVATE_KEY="your-private-key"
VAPID_SUBJECT="mailto:support@tastas.jp"
```

### 2.4 データベースの起動

```bash
docker-compose up -d
```

### 2.5 データベースの初期化

```bash
npx prisma generate
npx prisma db push
tsx prisma/seed.ts  # シードデータ投入
```

### 2.6 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス可能

---

## 3. よく使うコマンド

### 開発

```bash
npm run dev           # 開発サーバー起動
npm run build         # ビルド
npm run lint          # ESLint実行
npm run type-check    # TypeScript型チェック
```

### データベース

```bash
docker-compose up -d          # PostgreSQL起動
docker-compose down           # PostgreSQL停止
npx prisma studio             # Prisma Studio（DB GUI）
npx prisma generate           # Prisma Client再生成
npx prisma db push            # スキーマをDBに反映
npx prisma migrate dev        # マイグレーション作成・適用
tsx prisma/seed.ts            # シードデータ投入
```

### E2Eテスト

```bash
npx playwright test                    # 全テスト実行
npx playwright test --ui               # UI モードで実行
npx playwright test tests/e2e/xxx.spec.ts  # 特定テスト実行
```

---

## 4. プロジェクト構成

```
share-worker-app/
├── app/                      # Next.js App Router
│   ├── (worker)/            # ワーカー向け画面
│   ├── admin/               # 施設管理者向け画面
│   ├── system-admin/        # システム管理者向け画面
│   └── api/                 # API Routes
├── components/              # 共通コンポーネント
│   ├── ui/                  # 基本UIコンポーネント
│   └── pwa/                 # PWA関連コンポーネント
├── lib/                     # ユーティリティ・ロジック
│   ├── actions.ts           # Server Actions
│   └── prisma.ts            # Prisma Client
├── prisma/
│   ├── schema.prisma        # DBスキーマ
│   └── seed.ts              # シードデータ
├── public/                  # 静的ファイル
├── docs/                    # ドキュメント
└── tests/                   # テストファイル
```

---

## 5. 開発フロー

### 5.1 ブランチ戦略

```
main              # 本番環境（直接push禁止）
  └── develop     # ステージング環境
       ├── feature/xxx   # 機能開発
       └── fix/xxx       # バグ修正
```

### 5.2 プルリクエスト

1. `feature/xxx` または `fix/xxx` ブランチを作成
2. 実装・テスト
3. `develop` ブランチに向けてPRを作成
4. レビュー・マージ
5. ステージング環境で確認
6. `develop` → `main` へのPRを作成（管理者）

### 5.3 コミットメッセージ

```
機能追加: 〇〇機能を追加
バグ修正: 〇〇の問題を修正
リファクタリング: 〇〇のコードを整理
ドキュメント: 〇〇のドキュメントを更新
```

---

## 6. トラブルシューティング

### CSSが効かない

```bash
# キャッシュクリアして再起動
lsof -ti :3000 | xargs kill -9 2>/dev/null
rm -rf .next && npm run dev
```

### 環境変数が反映されない

```bash
# 環境変数をクリア
unset DATABASE_URL DIRECT_URL
npm run dev
```

### Prismaエラー

```bash
npx prisma generate
npx prisma db push
```

---

## 7. テストアカウント

### ワーカー

| 項目 | 値 |
|------|-----|
| Email | test-worker@example.com |
| Password | password123 |

### 施設管理者

| 項目 | 値 |
|------|-----|
| Email | test-admin@example.com |
| Password | password123 |

### システム管理者

| 項目 | 値 |
|------|-----|
| Email | admin@tastas.jp |
| Password | admin123 |

---

## 8. 関連ドキュメント

- [システム設計書](../specifications/system-design.md)
- [画面仕様書](../specifications/screen-specification.md)
- [デプロイガイド](./deployment.md)
