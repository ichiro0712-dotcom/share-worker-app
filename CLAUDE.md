# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

S WORKS - 看護師・介護士向け求人マッチングWebサービス (Nurse & Caregiver Job Matching Web Service)

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm run lint             # Run ESLint

# Database
docker-compose up -d     # Start PostgreSQL (localhost:5432)
npx prisma studio        # Open Prisma Studio (localhost:5555)
npx prisma generate      # Regenerate Prisma Client
npx prisma db push       # Push schema changes to DB
npx prisma migrate dev   # Create and apply migration
tsx prisma/seed.ts       # Run database seed
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Docker)
- **ORM**: Prisma
- **Auth**: NextAuth.js (JWT strategy, credentials provider)

### Path Aliases
`@/*` maps to project root (e.g., `@/lib/auth`, `@/components/ui/Button`)

## Documentation

サイトの仕様は `docs/` ディレクトリを参照:
- `requirements.md` - 要件定義書
- `screen-specification.md` - 画面仕様書
- `system-design.md` - システム設計書

### ドキュメント更新ルール
会話の中で新たな要件や、システム、開発計画の変更があった場合は、該当するドキュメント（要件定義書、システム設計書、画面仕様書など）も更新する。ただし、**必ず「このように書き換えていいですか？」とユーザーに確認してから**変更を行うこと。

### 指標定義の同期ルール（重要）
アナリティクスやダッシュボードで使用する**指標（メトリクス）の定義や名称を変更**した場合、以下の2箇所を**必ず同時に更新**すること：

1. **コード側**: `app/system-admin/analytics/tabs/MetricDefinitions.tsx`
   - `METRIC_DEFINITIONS` オブジェクト内の該当指標を更新
   - `key`, `label`, `definition`, `calculation`, `usedIn` を正確に記載

2. **仕様書側**: `docs/system-design.md` の「指標定義」セクション
   - 同じ内容を仕様書にも反映

**同期対象の変更例:**
- 指標名（ラベル）の変更
- 計算ロジックの変更
- 新しい指標の追加
- 指標の削除
- 使用箇所の変更

**注意:** コードと仕様書で定義が異なると混乱の原因になる。変更時は必ず両方を確認し、相違がないようにすること。

## 開発体制

### 無料LLMとの並行開発
このプロジェクトは有料のClaude Code（本AI）と無料のLLMを並行して使用している。

**作業の振り分け方針:**
- **Claude Codeで行う作業**: 複雑なロジック設計、アーキテクチャ決定、デバッグ、コードレビュー
- **無料LLMに委託する作業**: 単純な繰り返し作業、大量のファイル変更、定型的なコード生成

**無料LLMへの委託方法:**
クレジットを多く消費する作業や単純な作業は、無料LLMへの指示書を作成し、ユーザーを通して無料LLMに実行させる。指示書には以下を含める：
1. 作業の目的と背景
2. 具体的な変更内容（ファイルパス、変更箇所）
3. 完了条件と確認方法
4. **必須チェックリスト**（以下を指示書末尾に必ず記載）

**無料LLM作業後の必須チェックリスト:**
指示書の末尾には、以下のチェックリストを必ず含めること：

```markdown
## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
tailwind.config.ts、globals.css、その他スタイル関連ファイルを変更した場合：
\`\`\`bash
rm -rf .next && npm run build
\`\`\`

### 2. TypeScriptエラーチェック
\`\`\`bash
npm run build
\`\`\`
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
\`\`\`bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
\`\`\`

### 4. ブラウザ確認
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- DevToolsのNetworkタブで「Disable cache」をチェックして確認

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。
```

**CSS/スタイルが効かない問題の原因と対策:**
- **原因**: Next.jsの`.next`キャッシュが古いスタイルを保持している
- **対策**: Tailwind設定やCSSを変更した後は、必ず`rm -rf .next`を実行してからビルド/起動する

## トラブルシューティング

### CSSが効かなくなった時（よくある問題）

**症状**: スタイルが適用されない、レイアウトが崩れる、色が反映されない

**解決手順**:
```bash
# 1. 開発サーバーを停止（ポート3000を使用中のプロセスを終了）
lsof -ti :3000 | xargs kill -9 2>/dev/null

# 2. キャッシュを削除して再ビルド
rm -rf .next && npm run build

# 3. 開発サーバーを再起動
npm run dev
```

**ブラウザ側の対応**:
- ハードリロード: `Cmd+Shift+R`（Mac）/ `Ctrl+Shift+R`（Windows）
- または DevTools → Network タブ → 「Disable cache」をチェック

**補足**: この問題はNext.jsの`.next`キャッシュが原因で頻繁に発生する。CSS関連の変更をした後は予防的にキャッシュクリアを行うと良い。

## Claude Code自動メンテナンス

### 開発サーバー自動リフレッシュ
Next.jsの開発サーバーは長時間稼働やファイル編集の蓄積でキャッシュが壊れやすい。
以下の条件に該当する場合、Claude Codeはユーザーに確認せず自動でサーバーリフレッシュを実行する：

**自動実行トリガー:**
1. セッション開始時（前回からの継続時）
2. 5ファイル以上の編集を行った後
3. 以下のファイルを編集した後：
   - `tailwind.config.ts`
   - `globals.css` または任意の`.css`ファイル
   - `constants/`配下のファイル
   - `components/ui/`配下のファイル
4. ユーザーから「CSSが効いてない」「スタイルがおかしい」等の報告があった時

**実行コマンド:**
```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; sleep 1; rm -rf .next && npm run dev
```

**注意:** このメンテナンスは開発効率のため自動実行される。ユーザーへの確認は不要。

## 本番デプロイ前チェックリスト

デプロイ前に以下を必ず確認・設定すること。

### 1. 環境変数の設定（必須）

本番環境の `.env` に以下を追加：

```bash
# System Admin認証用シークレット（32文字以上のランダム文字列）
SYSTEM_ADMIN_SESSION_SECRET=ここに32文字以上のランダムな文字列を設定

# NextAuth設定
NEXTAUTH_SECRET=本番用のシークレット
NEXTAUTH_URL=https://本番ドメイン

# データベース接続
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**シークレット生成コマンド:**
```bash
openssl rand -base64 32
```

### 2. データベースマイグレーション

```bash
npx prisma migrate deploy
npx prisma db seed  # 必要に応じて
```

### 3. セキュリティ確認

- [ ] `NODE_ENV=production` が設定されている
- [ ] 全ての環境変数が本番用に設定されている
- [ ] HTTPSが有効になっている
- [ ] System Admin認証がCookieベースで動作確認済み
- [ ] 開発用バックドアが無効化されている（自動テストユーザー作成は削除済み）

### 4. ビルド確認

```bash
npm run build  # TypeScriptエラーがないこと
npm run lint   # Lintエラーがないこと
```

### 5. 機能テスト

- [ ] ワーカーログイン/登録
- [ ] 施設管理者ログイン
- [ ] System Adminログイン（admin@sworks.com）
- [ ] 求人検索・応募フロー
- [ ] メッセージ機能

### 6. 本番デプロイ後の確認

- [ ] System Admin管理画面にアクセスできる
- [ ] セッションが正常に維持される（8時間）
- [ ] エラーログに異常がない

---

## Development Guidelines

### Git Workflow
- `main`: Production branch (no direct commits)
- `feature/xxx`: Feature development
- `fix/xxx`: Bug fixes
- Commit messages in Japanese: `機能追加: ...`, `バグ修正: ...`, `リファクタリング: ...`

### Code Quality
- Run `npm run build` before committing to ensure no TypeScript errors
- Server Actions for all DB operations (see `src/lib/actions.ts`)
- Use existing component patterns from `components/ui/`
