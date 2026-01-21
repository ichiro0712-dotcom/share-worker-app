# DBスキーマ自動同期ガイド

本番DBとPrismaスキーマの同期を自動化する仕組みについて説明します。

## 概要

開発環境（Prismaスキーマ）と本番DBの差分を自動検出・同期する2層の安全策を実装しています。

| レイヤー | タイミング | 動作 |
|---------|-----------|------|
| Claude Code Hooks | `schema.prisma`編集時 | 差分を警告表示 |
| GitHub Actions | mainマージ時 | 安全な変更を自動適用 |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  ローカル開発                                                │
│                                                             │
│  prisma/schema.prisma を編集                                │
│           ↓                                                 │
│  Claude Code Hooks が自動実行                               │
│           ↓                                                 │
│  ✅ 差分なし     → そのまま続行                             │
│  ⚠️ 削除あり     → 警告表示（確認を促す）                   │
│  ✅ 追加/変更のみ → 情報表示                                │
└─────────────────────────────────────────────────────────────┘
                              ↓ PR作成 → マージ
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (mainマージ時)                              │
│                                                             │
│  ✅ 差分なし     → 何もしない                               │
│  ✅ 追加/変更のみ → 自動で本番DBに適用                      │
│  🚫 削除あり     → ブロック + GitHubにIssue作成             │
└─────────────────────────────────────────────────────────────┘
```

## 安全性設計

### 変更タイプ別の動作

| 変更タイプ | 例 | ローカル | GitHub Actions |
|-----------|-----|---------|----------------|
| テーブル追加 | `CREATE TABLE` | 情報表示 | 自動適用 |
| カラム追加 | `ADD COLUMN` | 情報表示 | 自動適用 |
| カラム変更 | `ALTER COLUMN` | 情報表示 | 自動適用 |
| テーブル削除 | `DROP TABLE` | **警告** | **ブロック** |
| カラム削除 | `DROP COLUMN` | **警告** | **ブロック** |

### 破壊的変更のブロック

削除を含む変更がmainにマージされた場合：

1. GitHub Actionsがブロック
2. GitHubに自動でIssueが作成される
3. 手動で確認・適用が必要

## ファイル構成

```
.
├── .claude/
│   └── settings.json          # Claude Code Hooks設定
├── .github/
│   └── workflows/
│       └── db-schema-sync.yml # 自動同期ワークフロー
├── scripts/
│   └── check-schema-diff.sh   # 差分チェックスクリプト
└── prisma/
    └── schema.prisma          # Prismaスキーマ（正）
```

## 設定詳細

### Claude Code Hooks

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // empty' | grep -q 'prisma/schema.prisma' && \"$CLAUDE_PROJECT_DIR\"/scripts/check-schema-diff.sh || true",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**動作**: `Edit`または`Write`ツールが実行された後、ファイルパスが`prisma/schema.prisma`なら差分チェックスクリプトを実行。

### GitHub Actions

`.github/workflows/db-schema-sync.yml`:

- **トリガー**: mainブランチへのpush（`prisma/schema.prisma`変更時のみ）
- **必要なSecrets**:
  - `PRODUCTION_DATABASE_URL`: 本番DB接続URL（PgBouncer経由）
  - `PRODUCTION_DIRECT_URL`: 本番DB直接接続URL

### 差分チェックスクリプト

`scripts/check-schema-diff.sh`:

```bash
# 手動実行
./scripts/check-schema-diff.sh
```

**前提条件**: `.env.production.local`に本番DB接続情報が必要

```bash
# 本番環境変数を取得
vercel env pull .env.production.local --environment=production
```

## 運用手順

### 通常のスキーマ変更

1. `prisma/schema.prisma`を編集
2. Claude Code Hooksが差分を表示
3. 問題なければコミット → PR作成 → マージ
4. GitHub Actionsが自動で本番DBに適用

### 破壊的変更（カラム/テーブル削除）

1. `prisma/schema.prisma`を編集
2. Claude Code Hooksが**警告**を表示
3. データ損失の影響を確認
4. コミット → PR作成 → マージ
5. GitHub Actionsが**ブロック** → Issue作成
6. 手動で確認後、以下を実行:

```bash
# 本番環境変数を読み込んで適用
source .env.production.local
npx prisma db push
```

### 手動で差分を確認

```bash
# 本番環境変数を取得（初回のみ）
vercel env pull .env.production.local --environment=production

# 差分チェック
./scripts/check-schema-diff.sh

# または直接Prismaコマンド
source .env.production.local
npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma
```

## トラブルシューティング

### Hooksが動作しない

```bash
# Hooks設定を確認
cat .claude/settings.json

# スクリプトの実行権限を確認
ls -la scripts/check-schema-diff.sh
```

### GitHub Actionsが失敗する

1. Actionsタブでログを確認
2. Secretsが正しく設定されているか確認:
   - `PRODUCTION_DATABASE_URL`
   - `PRODUCTION_DIRECT_URL`

### 本番DB接続エラー

```bash
# DIRECT_URLを使用しているか確認（PgBouncer経由ではスキーマ操作不可）
grep "DIRECT_URL" .env.production.local
```

## 関連リンク

- [GitHub Actions](https://github.com/ichiro0712-dotcom/share-worker-app/actions)
- [Prisma Migrate Diff](https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-diff)
- [Claude Code Hooks](https://docs.anthropic.com/claude-code/hooks)

---

最終更新: 2026-01-21
