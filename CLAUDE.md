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
