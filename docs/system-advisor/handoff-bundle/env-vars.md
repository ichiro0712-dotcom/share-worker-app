# env-vars — 環境変数全リスト + 取得方法

**作成**: 2026-05-04
**目的**: hub-platform 側で Advisor 機能を動かすために必要な環境変数を網羅
**重要**: **実値は本ドキュメントに含めない** (セキュリティ)。各環境変数の「変数名 + 用途 + 取得方法」のみ。

---

## 1. 必須 (Advisor 動作に絶対必要)

### LLM API キー

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API (一般チャット) | https://console.anthropic.com/settings/keys (`sk-ant-api03-...`) |
| `GEMINI_API_KEY` | Gemini API (レポート生成 / バイパス) | https://aistudio.google.com/apikey (`AIza...`) |

### DB 接続

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `DATABASE_URL` | Advisor 自身のテーブル用 (sessions / messages / drafts / versions 等) | Prisma datasource、PostgreSQL 接続文字列 |
| `DIRECT_URL` | Prisma の direct 接続 (migration 用、Supabase pgBouncer 環境で必要) | DATABASE_URL と別の direct ポート |
| `ADVISOR_DATA_DATABASE_URL` | **本番 DB (業務データ) 読み取り専用接続** | TASTAS の advisor_readonly ロールで作成、SELECT 権限のみ |

⚠️ `ADVISOR_DATA_DATABASE_URL` は **`advisor_readonly` ロール** (SELECT 権限のみ、INSERT/UPDATE/DELETE/TRUNCATE 剥奪) を使うこと。普通の admin ロールは絶対に使わない。

### 認証 / Cron

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `ADVISOR_CRON_SECRET` | Advisor cron (`/api/cron/advisor-cleanup` 等) の認証 | `openssl rand -base64 32` で生成 |

---

## 2. ツール用 (該当ツールを使うなら必要)

### GitHub (`get_recent_commits`, `read_repo_file`, `search_codebase`, knowledge sync)

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `GITHUB_TOKEN_FOR_ADVISOR` | GitHub Contents API / Commits API | Personal Access Token (`repo:read` 権限のみで OK) |
| `ADVISOR_GITHUB_OWNER` | リポジトリオーナー (固定値) | 例: `ichiro0712-dotcom` |
| `ADVISOR_GITHUB_REPO` | リポジトリ名 (固定値) | 例: `share-worker-app` |

### GA4 (`query_ga4`)

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `GA4_PROPERTY_ID` | GA4 プロパティ ID (固定値) | GA4 管理画面 → プロパティ設定 |
| `GA_CREDENTIALS_JSON` | GCP Service Account の認証 JSON | GCP Console → IAM → Service Account 作成 → JSON ダウンロード → 1 行化して env に |
| (alt) `GOOGLE_APPLICATION_CREDENTIALS` | ローカル開発用、JSON ファイルパス | ローカルファイル `credentials/ga-service-account.json` 等 |

### Search Console (`query_search_console`)

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `SEARCH_CONSOLE_SITE_URL` | 対象サイト | 例: `sc-domain:tastas.work` または `https://tastas.work/` |
| `GA_CREDENTIALS_JSON` | (上記 GA4 と同じ Service Account を使う) | Search Console プロパティに **「制限付きユーザー」以上**で追加が必要 |

### Supabase ログ (`get_supabase_logs`)

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `SUPABASE_MANAGEMENT_TOKEN` | Supabase Management API | https://supabase.com/dashboard/account/tokens (`sbp_...`) |
| `SUPABASE_PROJECT_REF` | 対象 Supabase プロジェクト ID (固定値) | Supabase ダッシュボード URL から (`/project/{ref}`) |

### Vercel (`get_vercel_logs`, `get_vercel_deployments`)

| 変数名 | 用途 | 取得方法 |
|---|---|---|
| `VERCEL_API_TOKEN` | Vercel REST API | https://vercel.com/account/tokens (`vcp_...`) |
| `VERCEL_PROJECT_ID` | 対象プロジェクト固定 (アカウント全体検索を防ぐ) | Vercel ダッシュボード → Settings → General |
| `VERCEL_TEAM_ID` | Team プランのみ必要 | Team Settings → General |

---

## 3. オプション

| 変数名 | 用途 | デフォルト |
|---|---|---|
| `ADVISOR_DAILY_TOKEN_CAP` | 1 日のトークン上限 (cost-guard) | `2_000_000` (=200 万) |

---

## 4. 廃止された環境変数 (使わない)

| 変数名 | 理由 |
|---|---|
| `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` | 「Chat に送信」機能を 2026-05-04 撤去 (BUG_FIX_PLAYBOOK #15) |

---

## 5. 環境変数の管理 (TASTAS 側のルール)

⚠️ **TASTAS の CLAUDE.md ルール**:
- Vercel 環境変数の CLI 操作 (`vercel env add/rm/pull`) は **Claude Code が実行禁止**
- 必要な場合は「変数名 + 値 + 対象環境」をユーザーに報告して**手動操作**してもらう
- 詳細: [ANTI_PATTERNS.md §6](./knowledge/ANTI_PATTERNS.md)

hub-platform 側でも同じルールを継承するか、運用方針を別途決めること。

---

## 6. ローカル開発の `.env.local` 例

```bash
# === 必須 ===
DATABASE_URL=postgresql://sworks:sworks123@localhost:5432/sworks_dev?...
ANTHROPIC_API_KEY=sk-ant-api03-XXXXX
GEMINI_API_KEY=AIzaXXXXX
ADVISOR_CRON_SECRET=$(openssl rand -base64 32)

# === GitHub ===
GITHUB_TOKEN_FOR_ADVISOR=ghp_XXXXX
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app

# === GA4 ===
GA4_PROPERTY_ID=522574288
GOOGLE_APPLICATION_CREDENTIALS=credentials/ga-service-account.json

# === 本番データ読み取り (advisor_readonly ロール) ===
ADVISOR_DATA_DATABASE_URL=postgresql://advisor_readonly.RFREF:PASS@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres

# === Supabase ログ ===
SUPABASE_MANAGEMENT_TOKEN=sbp_XXXXX
SUPABASE_PROJECT_REF=ryvyuxomiqcgkspmpltk

# === Search Console ===
SEARCH_CONSOLE_SITE_URL=sc-domain:tastas.work

# === Vercel ===
VERCEL_API_TOKEN=vcp_XXXXX
VERCEL_PROJECT_ID=prj_XXXXX
```

---

## 7. 関連ドキュメント

- [docs/08_DEPLOY_REQUIREMENTS.md](./docs/08_DEPLOY_REQUIREMENTS.md) — デプロイ時のチェックリスト
- [docs/07_SECURITY_COST.md](./docs/07_SECURITY_COST.md) — セキュリティ設計 (advisor_readonly ロール作成 SQL 含む)
- [extra-config/middleware.ts](./extra-config/middleware.ts) — `/advisor/r/[token]` の認証バイパス設定
