# 【システム責任者向け】 System Advisor ステージング展開作業依頼

**作成日**: 2026-05-01 (最終更新: **2026-05-07** — STEP 4 / STEP 3 / STEP 6 の整合性修正)
**対象環境**: ステージング (https://stg-share-worker.vercel.app)
**対象ブランチ**: `feature/system-advisor-chatbot` → `develop` へ PR でマージ予定
**所要時間目安**: 50〜70 分 (待機時間含む / STEP 2 はスキップで短縮)

---

## 📌 2026-05-07 追記サマリ (整合性修正版)

このセクションは「前回 (〜2026-05-06) 版を読み終えて作業中の方」向けの **差分・訂正サマリ** です。

### ⚠️ 重要な訂正 (前回までの記述ミスを修正)

| 旧記述 | 訂正内容 |
|---|---|
| STEP 3 表の脚注「`GA_CREDENTIALS_JSON` は既存のものを流用するため**新規追加不要**」 | **❌ 誤り。実際は Vercel に未登録だった**。今回新規追加が必要 (詳細は STEP 3 内の追加 #15 参照) |
| STEP 4 の Service Account 例「`tastas-ga-reader@xxx.iam.gserviceaccount.com`」 | **正しい client_email は `tastas-api-user@tastas-488506.iam.gserviceaccount.com`** (開発者から JSON ファイル本体を Google Chat で別途共有) |
| STEP 6 項目 #12「サイドバー**下部**のレポート履歴リンク」 | **サイドバー**上部** (新規 chat ボタン直下) に移動済み**。クリック先 `/system-admin/advisor/reports` は同じ |
| 概要表「新規 Vercel 環境変数 14 個」 | **16 個** (`GA_CREDENTIALS_JSON` + `GA4_PROPERTY_ID` を追加)。Hobby プランなら `VERCEL_TEAM_ID` を除く 15 個 |

### 2026-05-06 で追加された UX 改修 (DB / 環境変数 / cron への影響なし)
- **レポート履歴一覧の UX 刷新** (`/system-admin/advisor/reports`)
  - 1 セッション = 1 行表示 (古いバージョンが履歴に並ばない、最新 1 件のみ表示)
  - 行全体クリックでセッション画面に遷移
  - 各行に「しおり」トグル / 「期限」表示 (しおり ON は永続保存、OFF は あと N 日)
  - 「しおり付き優先」ソートを追加
- **個別レポート画面 (`/reports/[versionId]`) を撤去**
  - 機能はすべて Canvas 側に集約済み (URL 共有 / コピー / 編集 / 削除)
  - 古いバージョンを見たいときは「履歴 → セッション画面 → Canvas のバージョンドロップダウンで切替」
- **サイドバーの「レポート履歴」リンクを「新規チャット」ボタン直下に配置**

### 動作確認に追加してほしい項目 (前回サマリから継続)
STEP 6 を実施するときに、以下も確認してください (本文の表 #12 を新表現に置き換えて読む):

| # | シナリオ | 期待動作 |
|---|---|---|
| A | サイドバー左上の「新規chat」直下「**レポート履歴**」リンクを押す (旧 #12 の位置を移動) | `/system-admin/advisor/reports` に遷移 |
| B | レポート履歴一覧で 1 セッションの最新 1 件のみ表示されている | 古いバージョンが並んでいない |
| C | 行のどこをクリックしても (タイトルでなく) セッション画面に飛ぶ | URL に `?c=sessionId` が付き、過去の会話履歴と Canvas が表示される |
| D | 期限カラムが表示される | しおりなしは「あと N 日」、しおり ON は「永続保存」バッジ |
| E | しおりアイコンをクリックして ON/OFF できる | 行全体クリックは発火しない (しおり列だけ反応) |
| F | 並び替えで「しおり付き優先」を選ぶ | しおり ON のセッションが上に来る |
| G | 旧 URL `/system-admin/advisor/reports/[versionId]` を踏む | 404 になる (個別ページ撤去) |

---

## このドキュメントの読み方

1. **§1 概要** で何を入れるか把握
2. **§2 事前準備** で必要なクレデンシャル・アクセスを確認
3. **§3 作業手順** を上から順に実施 (☐ にチェックを入れる)
4. 各ステップで **「動作確認」** を必ずパスしてから次に進む
5. 何かあれば **§7 トラブルシューティング** を参照

> ⚠️ **本番への展開はまだ依頼しません。** 今回はステージングのみ。
> ステージングで動作確認後、別途本番展開の依頼文を作ります。

---

## 1. 概要

System Advisor (`/system-admin/advisor`) は、System Admin 専用の LLM チャットボットです。
GitHub / 本番 Supabase (読み取り専用) / GA4 / Search Console / Vercel / Supabase Logs を横断的に
読んで、運用判断や仕様確認をサポートします。

### 今回ステージングに入れるもの

| カテゴリ | 内容 |
|---|---|
| **新規 DB テーブル** | 11 個 (Advisor 関連、本体テーブルは触らない) |
| **既存 Advisor テーブルへのカラム追加** | `advisor_chat_sessions.bookmarked` (しおり) / `advisor_report_drafts` に 3 カラム (`metric_keys` / `original_request` / `skeleton_markdown`) / `advisor_report_versions` に 3 カラム (`share_token` / `shared_at` / `shared_until`、共有 URL) |
| **新規 Vercel 環境変数** | **16 個** (Hobby プランなら `VERCEL_TEAM_ID` を除く 15 個。Anthropic / Gemini / GitHub / Supabase / Search Console / Vercel API / GA Service Account JSON 等) |
| **新規 Vercel Cron** | `advisor-cleanup` (毎日 04:00 JST = `0 19 * * *` UTC、保持期間に基づく自動削除) + `advisor-semantic-ingest` (毎日 04:30 JST = `30 19 * * *` UTC、しおり付きセッションの最新レポートを意味的記憶に取り込み) — 両方 vercel.json に既登録 |
| **コード追加** | `src/lib/advisor/`, `app/system-admin/advisor/`, `app/api/advisor/`, `app/api/cron/advisor-cleanup/`, `app/advisor/r/[token]/`, `docs/system-advisor/` 配下 |

### Advisor の主な機能

- **LLM チャット** (Anthropic Claude Sonnet 4.6 / Opus / Haiku 切替可、System Admin 認証必須)
- **ツール 19 個** (本番 Supabase 業務データ集計 / GA4 / Search Console / Vercel / Supabase ログ / GitHub コードベース検索 / ドキュメント検索 / レポート要件 update)
- **レポート機能** (右側 Canvas で要件固め → 「レポート作成」ボタンで Gemini に投入 → Markdown 生成)
- **レポート編集** (Canvas 上で Markdown 直接編集、もしくはチャットで「○章を簡潔に」と LLM に部分修正依頼)
- **レポート バージョン管理** (生成 / 手動編集 / LLM 編集の履歴を保持、過去版に戻れる)
- **レポート公開シェア URL** (`/advisor/r/[token]` で認証なし閲覧可、デフォルト 30 日有効、+30 日延長 / 即時停止 / 失効後の token は cron で自動 cleanup)
- **しおり (永続保存)** (チャットセッションに ON 設定 → 配下の Draft / Versions が保持期間 cron の削除対象外に)
- **保持期間 cron** (毎日 04:00 JST に走り、しおりなし Draft/Versions は 30 日 / Audit ログは 90 日 [report 系は 180 日] で削除)
- **レポート履歴一覧画面** (`/system-admin/advisor/reports` で全バージョン横断、個別削除可)
- **設定ページ** (`/system-admin/advisor/settings` でラリー回数 / プロンプト編集 / モデル切替 / データソース可用性 / 月次使用統計)
- **生成中断ボタン** (Gemini 生成中に Cancel 可能、AbortController 経由)
- **進捗 heartbeat 表示** (Claude Code 風、経過秒数 + 出力トークン数)
- **意味的記憶 (semantic memory)** (しおり付きセッションの最新レポートを毎日 04:30 JST に cron で取り込み → 新しいチャットで「先月のレポートで言ってた○○」のような文脈依存質問に LLM が答えられる、最新 5 件まで system prompt に埋め込み)

---

## 2. 事前準備 (作業者側で揃えるもの)

| # | 必要なもの | 取得方法 |
|---|---|---|
| 1 | **Vercel ダッシュボードへのアクセス** | tastas プロジェクトの Settings 編集権限 |
| 2 | **Supabase ステージングプロジェクトへのアクセス** | プロジェクト ID `qcovuuqxyihbpjlgccxz`、SQL Editor 編集権限 |
| 3 | **Supabase 本番プロジェクトへのアクセス** | プロジェクト ID `ryvyuxomiqcgkspmpltk` (`advisor_readonly` ロールは作成済み。STEP 2 は新規作業なし) |
| 4 | **Anthropic API キー** | [console.anthropic.com](https://console.anthropic.com/settings/keys) で発行 (sk-ant-api03-...) |
| 5 | **Gemini API キー** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) で発行 (AIza...) |
| 6 | **GitHub PAT (read-only)** | 開発者 (川島) から共有済 or `ichiro0712-dotcom` アカウントで発行 (`repo:read` 権限のみ) |
| 7 | **Supabase Management Token** | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) で発行 (sbp_...) |
| 8 | **GCP Service Account JSON (既存)** | GA4 Reporting で使っている Service Account を流用 (Vercel に既に登録済み環境変数 `GA_CREDENTIALS_JSON`) |
| 9 | **Google Search Console プロパティへのアクセス** | tastas.work プロパティの所有者権限 |
| 10 | **Google Chat スペースへの管理権限** | 配信先にしたい Space で Webhook 作成可能な権限 |

---

## 3. 作業手順

### STEP 1: ステージング DB に Advisor 用テーブルを作成 ☐

#### 1-1. dry-run で SQL を確認

```bash
# ステージング DB の接続文字列に置き換える (パスワードは Supabase ダッシュボードから取得)
DATABASE_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
  npx prisma migrate diff \
    --from-schema-datamodel prisma/schema.prisma \
    --to-url "$DATABASE_URL" \
    --script
```

期待される出力: 以下 **11 個の `CREATE TABLE`** が含まれること

1. `advisor_chat_sessions`
2. `advisor_chat_messages`
3. `advisor_audit_logs`
4. `advisor_knowledge_cache`
5. `advisor_knowledge_sync_logs`
6. `advisor_saved_prompts`
7. `advisor_usage_daily`
8. `advisor_report_drafts`
9. `advisor_settings`
10. `advisor_report_versions`
11. `advisor_semantic_memory` (2026-05-06 — しおり付きセッションの過去レポートを意味的記憶として保持)

加えて、以下のカラム追加 (`ALTER TABLE ... ADD COLUMN`) も含まれます。**いずれも追加のみで、既存データは保持されます。**

**`advisor_chat_sessions`**:
- `bookmarked` (Boolean, default false, 2026-05-04 — しおり機能)

**`advisor_report_drafts`**:
- `metric_keys` (Json?, P1-6 — query_metric の取得対象)
- `original_request` (Text?, 2026-05-02 — 元の要望保存)
- `skeleton_markdown` (Text?, 2026-05-02 — Canvas 用ドラフト本体)

**`advisor_report_versions`**:
- `share_token` (VarChar(64) UNIQUE NULLABLE, 2026-05-04 — 公開シェア URL)
- `shared_at` (Timestamp NULLABLE, 同上)
- `shared_until` (Timestamp NULLABLE, 同上)

**追加されるインデックス**:
- `advisor_chat_sessions_bookmarked_updated_at_idx` (cron の効率化用)
- `advisor_report_versions_share_token_key` (公開ページの token ルックアップ用、UNIQUE)
- `advisor_semantic_memory_admin_id_category_source_type_source_id_key` (UNIQUE、cron upsert 用)
- `advisor_semantic_memory_admin_id_category_updated_at_idx` (system prompt 埋め込み用、最新順)

> 🚨 **`DROP TABLE`、`ALTER TABLE ... DROP COLUMN`、`DROP INDEX` 等の破壊的 SQL が出てきたら即中止して開発者 (川島) に連絡してください。** (上記の `ADD COLUMN` および `CREATE INDEX` は問題ありません)

> なお、本番 DB に既に存在しているテーブル (`recommended_jobs`, `public_job_page_views`,
> `job_search_page_views`, `job_detail_page_views`, `registration_page_views`,
> `application_click_events`, `form_destinations`) はステージングでも反映済みなので追加されません。

#### 1-2. 本実行

dry-run で **11 個の CREATE TABLE + 上記 ADD COLUMN (`bookmarked` 1 個、ドラフトに 3 個、バージョンに 3 個) + 4 個の CREATE INDEX** のみだと確認後:

```bash
DATABASE_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
DIRECT_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
  npx prisma db push
```

#### 1-3. 動作確認

Supabase ダッシュボード → Database → Tables で以下が新規作成されていることを目視確認:

- [ ] `advisor_chat_sessions`
- [ ] `advisor_chat_messages`
- [ ] `advisor_audit_logs`
- [ ] `advisor_knowledge_cache`
- [ ] `advisor_knowledge_sync_logs`
- [ ] `advisor_saved_prompts`
- [ ] `advisor_usage_daily`
- [ ] `advisor_report_drafts`
- [ ] `advisor_settings`
- [ ] `advisor_report_versions`
- [ ] `advisor_semantic_memory` (2026-05-06 追加)

---

### STEP 2: 本番 Supabase 読み取り専用ロール ☑ (既に完了済み・作業不要)

#### 状況サマリ

- Advisor は **本番 Supabase の業務データを「読み取り専用」で参照** する設計
- そのための `advisor_readonly` 専用ロール (SELECT 権限のみ) は **既に作成済み**
- ローカル開発環境からこのロール経由で業務データ読み取りができることを開発者 (川島) が確認済み (2026-05-01)

#### システム責任者の作業

**本 STEP は新規作業なし**。STEP 3 で接続文字列 (`ADVISOR_DATA_DATABASE_URL`) を
Vercel 環境変数に登録するだけで、ステージング環境からも同じロールで本番業務データが読めます。

> 接続文字列は開発者 (川島) の `.env.local` に既に格納済み。
> Vercel への登録時に開発者から共有してもらってください (新規発行不要)。

#### なぜステージングでも本番データを読むのか

ステージング DB には本番データのコピーが無く、「現在公開中の求人は何件?」のような
Advisor の質問に意味のある答えを返すため、本番 Supabase に読み取り専用接続する設計です。
書き込みは `advisor_readonly` ロール側で禁止 + アプリ側で `SET TRANSACTION READ ONLY` の
二重防御。

<details>
<summary>📜 参考: 過去にロールを作成したときの SQL (再実行不要・記録のみ)</summary>

```sql
-- パスワードは強力なものを生成 (例: openssl rand -base64 32 で生成)
CREATE ROLE advisor_readonly WITH LOGIN PASSWORD 'GENERATED_STRONG_PASSWORD';

-- public スキーマ全テーブルの SELECT 権限のみ付与
GRANT USAGE ON SCHEMA public TO advisor_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO advisor_readonly;

-- 今後追加されるテーブルにも自動で SELECT 権限を付与
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO advisor_readonly;

-- 念のため書き込み系を明示的に剥奪
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM advisor_readonly;
```

接続文字列の形式 (Session Pooler 経由):
```
postgresql://advisor_readonly.ryvyuxomiqcgkspmpltk:GENERATED_PW@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```
パスワードに URL 特殊文字が含まれる場合は `encodeURIComponent` でエンコード必須。

</details>

---

### STEP 3: Vercel ステージング環境変数の追加 ☐

Vercel ダッシュボード → tastas プロジェクト → Settings → Environment Variables で
**Preview** 環境に以下を追加:

| # | 変数名 | 値 / 取得方法 | 用途 |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (新規発行) | Advisor のメイン LLM (チャット) |
| 2 | `GEMINI_API_KEY` | `AIza...` (Google AI Studio) | レポート本文生成 |
| 3 | `GITHUB_TOKEN_FOR_ADVISOR` | `ghp_...` (repo:read 権限のみ) | GitHub の知識同期 |
| 4 | `ADVISOR_GITHUB_OWNER` | `ichiro0712-dotcom` | (固定値) |
| 5 | `ADVISOR_GITHUB_REPO` | `share-worker-app` | (固定値) |
| 6 | `ADVISOR_CRON_SECRET` | ランダム文字列 (`openssl rand -base64 32` で生成) | 知識同期 cron の認証用 |
| 7 | `ADVISOR_DATA_DATABASE_URL` | 既存 `advisor_readonly` ロールの接続文字列 (開発者 川島から別途共有、新規作成不要) | 本番 Supabase 読み取り専用 |
| 8 | `SUPABASE_MANAGEMENT_TOKEN` | `sbp_...` (Supabase ダッシュボードで発行) | Supabase ログ取得用 |
| 9 | `SUPABASE_PROJECT_REF` | `ryvyuxomiqcgkspmpltk` | (本番 Supabase プロジェクト ID 固定値) |
| 10 | `SEARCH_CONSOLE_SITE_URL` | `sc-domain:tastas.work` | Search Console の対象サイト |
| 11 | `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` | `https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...` | レポートの Google Chat 配信先 |
| 12 | `VERCEL_API_TOKEN` | `vcp_...` ([Account Tokens](https://vercel.com/account/tokens) で発行) | Advisor の `get_vercel_logs` / `get_vercel_deployments` ツール用 |
| 13 | `VERCEL_PROJECT_ID` | `prj_...` (Vercel ダッシュボード → tastas プロジェクト → Settings → General) | 対象プロジェクトを share-worker-app に固定 (アカウント全体検索を防ぐ) |
| 14 | `VERCEL_TEAM_ID` | `team_...` (Team プランの場合のみ。Hobby なら不要) | Team Scope の API 呼び出し |
| 15 | `GA_CREDENTIALS_JSON` | GA Service Account JSON 全体 (1 行に圧縮した文字列) — 開発者 (川島) から Google Chat で別途共有 | GA4 Reporting API + Search Console 両方の認証 |
| 16 | `GA4_PROPERTY_ID` | `522574288` (固定値) | GA4 Reporting API の対象プロパティ |

> **`GA_CREDENTIALS_JSON` について (2026-05-07 訂正)**:
> 旧版の依頼書では「既存登録済みなので新規追加不要」と書いていましたが、**実際は Vercel に未登録**でした。お手数ですが新規追加をお願いします。
> Service Account 自体は既に作成・運用中 (`tastas-api-user@tastas-488506.iam.gserviceaccount.com`)。JSON は開発者ローカルにのみ存在するため Google Chat で別途共有します。
> 貼り付け時の注意: ① 改行を入れない (1 行 ~2300 文字) / ② 外側のクォート不要、`{` で始まり `}` で終わる JSON 本体 / ③ private_key 内の `\n` (バックスラッシュ + n) はそのまま残す (実改行に変換しない)。

> **`ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` の取得方法 (システム責任者側で発行が必要)**:
> 1. 配信先にしたい Google Chat スペースを開く
> 2. スペース名右側の▼ → 「アプリと統合」 → 「Webhook を追加」
> 3. 名前 (例: "TASTAS Advisor")、アイコン URL (任意) を設定
> 4. 「保存」 → 表示された URL をコピー

#### 動作確認

- [ ] Vercel ダッシュボードで **16 個** (Hobby プランなら `VERCEL_TEAM_ID` を除く 15 個) の環境変数が **Preview 環境** に追加されている
- [ ] `ANTHROPIC_API_KEY` が `sk-ant-api03-` で始まる正しい形式
- [ ] `ADVISOR_DATA_DATABASE_URL` の URL 中で特殊文字が `%XX` 形式にエンコードされている
- [ ] `VERCEL_PROJECT_ID` が **share-worker-app の ID** であること (別プロジェクトの ID にしない)
- [ ] `GA_CREDENTIALS_JSON` の値に改行が入っていない (1 行のまま登録されている)

---

### STEP 4: Search Console に Service Account を追加 ☐

> Service Account のメールアドレス: **`tastas-api-user@tastas-488506.iam.gserviceaccount.com`**
> (= STEP 3 で登録した `GA_CREDENTIALS_JSON` の `client_email` フィールドと同一)
>
> 既存の GA4 Reporting で使用中の Service Account をそのまま流用します。新規作成は不要です。

#### 4-1. 手順

1. [Google Search Console](https://search.google.com/search-console) を開く
2. プロパティ `sc-domain:tastas.work` (または `https://tastas.work/`) を選択
3. 設定 → ユーザーと権限 → ユーザーを追加
4. メールアドレス: `tastas-api-user@tastas-488506.iam.gserviceaccount.com`
5. 権限: **「制限付き」** (= 閲覧のみ。これで十分)
6. 追加

#### 4-2. 動作確認

- [ ] Search Console の「ユーザーと権限」一覧に `tastas-api-user@tastas-488506.iam.gserviceaccount.com` が表示されている
- [ ] 権限が「制限付き」になっている

> 実機の動作確認 (Advisor から `query_search_console` ツールで Search Console データが取れるか) は §STEP 6 の項目 #6 で実施します。

---

### STEP 5: GitHub にプッシュ → PR 作成 → マージ ☐

> このステップは開発者 (川島) が実施します。システム責任者は確認のみ。

開発者がやること:

1. `feature/system-advisor-chatbot` ブランチをリモートにプッシュ
2. `develop` 向けに PR を作成
3. システム責任者が PR をレビュー (任意)
4. システム責任者または開発者がマージ
5. Vercel が自動でステージング (https://stg-share-worker.vercel.app) にデプロイ

#### 5-1. PR の概要 (システム責任者が読むため)

- **影響範囲**: `src/lib/advisor/`, `app/system-admin/advisor/`, `app/api/advisor/`, `app/api/cron/advisor-knowledge-sync/`, `docs/system-advisor/`, `prisma/schema.prisma`, `middleware.ts`, `package.json`
- **本体テーブルへの影響**: なし (Advisor 関連テーブルの新規追加のみ)
- **既存機能への影響**: なし (`/system-admin/advisor` ルート以外は触らない)
- **Vercel ビルド**: ローカルで `npm run build` 通過済み
- **TypeScript**: `npx tsc --noEmit` でエラーなし

#### 5-2. 動作確認

- [ ] PR が `develop` 向けに作成されている (main 向けは禁止)
- [ ] CI チェックがパスしている
- [ ] develop へのマージ完了後、Vercel ダッシュボードで stg-share-worker のデプロイが進行・完了する
- [ ] ステージング URL (https://stg-share-worker.vercel.app) が正常に表示される

---

### STEP 6: ステージングでの動作確認 ☐

> このステップは **開発者 (川島) が動作確認** し、システム責任者は STEP 5 完了報告後の補助のみ。

確認項目 (`/system-admin/login` でログイン後に実施):

| # | シナリオ | 期待動作 |
|---|---|---|
| 1 | `/system-admin/advisor` を開く | チャット UI が表示される |
| 2 | 「こんにちは」と送信 | 通常応答が返る (LLM の文字がストリーミング表示される) |
| 3 | 「現在公開中の求人は何件?」 | `query_metric` ツール経由で本番 Supabase の値が返る |
| 4 | 「Job テーブルにはどんなカラム?」 | `describe_db_table` ツールでスキーマ説明が返る |
| 5 | 「先週の GA4 セッション数」 | `query_ga4` ツールで Data API 経由の数値が返る |
| 6 | 「先週の検索流入トップ 10」 | `query_search_console` ツールで Search Console データが返る |
| 7 | 「Supabase 直近 1 時間のログ」 | `get_supabase_logs` ツールでログが返る |
| 8 | 「先週の KPI を週次レポートでまとめて」 → 右 Canvas でドラフト化 → 「レポート作成」ボタン | Gemini でレポート生成、Canvas に Markdown 表示 |
| 9 | (削除済み: 「Chat に送信」機能は 2026-05-04 撤去) | — |
| 10 | 結果ビューの「編集」ボタン → 本文を直接編集 → 「保存」 | 新しいバージョン (v2) として保存される |
| 11 | チャットで「○章を簡潔に」と依頼 | `[TOOL:result_edit]` で Gemini が部分修正版 (v3) を作る |
| 12 | サイドバー上部 (新規 chat ボタン直下)「レポート履歴」リンク | `/system-admin/advisor/reports` でセッション単位の最新レポート一覧 (1 セッション = 1 行) |
| 13 | ヘッダー右上の歯車アイコン | `/system-admin/advisor/settings` で設定ページ |
| 14 | DevTools Console で `[advisor] heartbeat:` ログ | 5 秒ごとに heartbeat イベントが届いている |
| 15 | 「レポート作成」ツール選択 → 送信 | 右 Canvas にドラフト要件 + ドラフト本体 (0 埋めの表骨格) が表示される |
| 16 | チャットで「LP5 まで増やして」 | Canvas のドラフト本体の表が LP5 まで広がる (LP1〜LP5) |
| 17 | チャットで「会員登録数の表を足して」 | Canvas のドラフト本体に該当の表/章が増える |
| 18 | Canvas の「手動編集」ボタン → Markdown 編集 → 「保存」 | ドラフト本体が手動編集内容で更新される |
| 19 | Canvas のレポート要件を直接編集 → 「ドラフト更新」ボタン | 要件 (期間 / metric_keys / outline / notes) が保存される |
| 20 | 全部固まった状態で「レポート作成 (本文生成)」ボタン | ドラフト本体の構造を保ったまま実数値が入った最終レポートが Gemini で生成される |
| 21 | レポートヘッダーの「🔗 共有」ボタン → URL コピー → シークレットウィンドウで開く | 公開ページ `/advisor/r/{token}` が認証なしで表示される、「公開期限: あと 30 日」が表示される |
| 22 | 同じ画面で「+30 日延長」ボタン押下 | shared_until が 60 日先に更新され、同じ token で引き続き閲覧可能 |
| 23 | 同じ画面で「停止」ボタン押下 | 公開ページが 404 / expired になる、再有効化時は新しい token が発行される |
| 24 | チャットセッションのサイドバーで「しおり」アイコン押下 | amber アイコンが ON 表示、cron 削除対象から外れる |
| 25 | Canvas ヘッダーの ⋯ メニュー → 保持期間表示 | 「保存期間: あと N 日」(しおり OFF) または「しおりマーク (永続保存)」(ON) が表示される |

🐛 **不具合があれば本番展開前に修正**します (本ドキュメントは差し戻し OK)。

---

### STEP 7: Advisor cron 3 種類の手動実行 ☐

> Advisor は 3 つの cron を持ちます:
> 1. **`advisor-knowledge-sync`** — GitHub から CLAUDE.md / docs / Prisma schema を取得して `advisor_knowledge_cache` を更新
> 2. **`advisor-cleanup`** — 保持期間に基づく自動削除 (しおりなし Draft/Versions 30 日 / Audit ログ 90/180 日 / 失効済み share_token cleanup)
> 3. **`advisor-semantic-ingest`** (2026-05-06 追加) — しおり付きセッションの最新レポートを `advisor_semantic_memory` に取り込み (LLM が「先月のレポートで言ってた○○」のような文脈依存質問に答えられるようにする)

#### 7-1. `advisor-knowledge-sync` の手動トリガー

```bash
curl -X POST https://stg-share-worker.vercel.app/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

期待: HTTP 200 + `{ "synced": <件数> }` のような JSON 応答。

#### 7-2. `advisor-cleanup` の手動トリガー

```bash
curl -X POST https://stg-share-worker.vercel.app/api/cron/advisor-cleanup \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

期待: HTTP 200 + `{ "ok": true, "result": { "deletedDrafts": N, "deletedVersions": N, "deletedAuditLogs": N, "expiredSharesCleared": N } }`

> 初回実行直後はステージングにまだ古いデータが無いため、すべて 0 件で OK。

#### 7-3. `advisor-semantic-ingest` の手動トリガー (2026-05-06 追加)

```bash
curl -X POST https://stg-share-worker.vercel.app/api/cron/advisor-semantic-ingest \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

期待: HTTP 200 + `{ "ok": true, "result": { "bookmarkedSessions": N, "ingestedReports": N, "skippedNoVersion": N } }`

> 初回実行直後はしおり付きセッションが無いため、すべて 0 件で OK。
> 動作確認: ユーザーがしおり ON にしてレポート生成 → 翌日 04:30 JST 後に `advisor_semantic_memory` テーブルに 1 行入っているか確認。

#### 7-4. Vercel Cron 設定 (定期実行)

`vercel.json` に **`advisor-cleanup` (`0 19 * * *` UTC = 毎日 04:00 JST) と `advisor-semantic-ingest` (`30 19 * * *` UTC = 毎日 04:30 JST) が登録済み**。

`advisor-knowledge-sync` は **vercel.json 未登録** の状態。手動トリガーで運用するか、必要に応じて vercel.json に追加 (頻度は 1 時間〜1 日で十分):

```json
{
  "path": "/api/cron/advisor-knowledge-sync",
  "schedule": "0 * * * *"
}
```

> Hobby プランの cron 上限 (1 日 1 回) に注意。Pro プラン以上なら毎時 OK。

#### 7-5. 動作確認

- [ ] `advisor-knowledge-sync` が 200 を返す
- [ ] `advisor-cleanup` が 200 を返す (件数は 0 でも可)
- [ ] `advisor-semantic-ingest` が 200 を返す (件数は 0 でも可)
- [ ] Vercel ダッシュボード → Settings → Cron Jobs で **`advisor-cleanup` と `advisor-semantic-ingest` が登録されている** (vercel.json 由来、両方 04 時台 JST)

---

## 4. 完了報告フォーマット

全 STEP 終わったら開発者 (川島) に以下を報告:

```
【ステージング展開完了】
- STEP 1 (DB): 11 テーブル新規作成 + ADD COLUMN (bookmarked / metric_keys / original_request / skeleton_markdown / share_token / shared_at / shared_until) 全て確認 ☑
- STEP 2 (本番ロール): 既に過去に作成済み、新規作業なし ☑ (川島確認済み 2026-05-01)
- STEP 3 (Vercel 環境変数): 16 個全て追加 ☑ (Hobby プランなら VERCEL_TEAM_ID 除く 15 個)
- STEP 4 (Search Console): tastas-api-user@tastas-488506.iam.gserviceaccount.com を property に追加 ☑
- STEP 5 (GitHub PR + マージ): #578 マージ済 ☑
- STEP 6 (動作確認): 25 項目 + 2026-05-06 追加 7 項目 (A〜G) 全てパス (確認担当: 川島) ☑
- STEP 7 (cron 3 種): advisor-knowledge-sync / advisor-cleanup / advisor-semantic-ingest 全て 200 で同期完了確認 ☑

問題なし → 本番展開判断を待ちます
```

---

## 5. 環境変数一覧 (再掲・コピペ用)

```bash
# === 必須 16 個 (Hobby プランなら VERCEL_TEAM_ID を除く 15 個) ===
ANTHROPIC_API_KEY=sk-ant-api03-XXXXX
GEMINI_API_KEY=AIzaXXXXX
GITHUB_TOKEN_FOR_ADVISOR=ghp_XXXXX
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app
ADVISOR_CRON_SECRET=XXXXX
ADVISOR_DATA_DATABASE_URL=postgresql://advisor_readonly.ryvyuxomiqcgkspmpltk:XXXXX@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
SUPABASE_MANAGEMENT_TOKEN=sbp_XXXXX
SUPABASE_PROJECT_REF=ryvyuxomiqcgkspmpltk
SEARCH_CONSOLE_SITE_URL=sc-domain:tastas.work
ADVISOR_GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/XXXXX
VERCEL_API_TOKEN=vcp_XXXXX
VERCEL_PROJECT_ID=prj_XXXXX
VERCEL_TEAM_ID=team_XXXXX  # Hobby プランなら省略可
GA_CREDENTIALS_JSON={"type":"service_account",...}  # 開発者から Google Chat で別途共有 (1 行に圧縮)

# === 既存流用 (新規追加不要) ===
# DATABASE_URL  ← ステージング Supabase 既存設定
```

---

## 6. データ・トラフィックの想定

### Anthropic コスト (ステージング)

- 想定使用者: System Admin 数名
- 1 セッション: 5〜20 ターン、平均 5K input + 2K output トークン
- 1 セッション約 ¢2〜10 (USD)
- 1 日 5 セッションでも $0.50/日 程度
- **暴走対策**: ループ上限 20 (設定ページで変更可)、レート制限 (1h 60 req / 1d 500 req per admin)

### Gemini コスト (レポート生成 + Canvas バイパス)

- gemini-2.5-flash 使用 (安価)
- 1 レポート本文生成 ≈ ¢0.5〜2 (USD)
- ドラフト初回作成 / 修正 / 部分編集も Gemini バイパス (= `[TOOL:report_create|draft_revise|result_edit]`) で各 ¢0.1〜0.5
- 1 日 5 レポートでも $0.10/日 程度

### DB 容量

- `advisor_audit_logs` が一番増える (1 ターン = 数行)
- 想定: 1 日 100 行 × 365 日 = 4 万行/年 (容量負担は無視できる)
- **保持期間 cron で自動削除されるため、無制限増加は防止される** (一般 90 日 / report 系 180 日)

---

## 7. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `/system-admin/advisor` で 503 | `ANTHROPIC_API_KEY` 未設定 | Vercel 環境変数を確認 → Redeploy |
| Anthropic 401 invalid x-api-key | キー revoke / 残高 0 / typo | キー再発行・残高確認 |
| `query_metric` で permission denied | `advisor_readonly` ロールの GRANT 漏れ (新しいテーブルが追加された後など) | 開発者 (川島) に連絡。STEP 2 の `<details>` 内の `GRANT SELECT ...` を再実行する |
| `query_search_console` で 403 | Service Account を property に未追加 | STEP 4 を実施 |
| `query_ga4` / `query_search_console` で「認証情報が未設定」エラー | `GA_CREDENTIALS_JSON` 未登録 | STEP 3 #15 を実施 (開発者から JSON を別途共有) |
| `query_ga4` で「invalid_grant」「PEM」「private_key」関連エラー | `GA_CREDENTIALS_JSON` 内の `\n` が実改行に変換されている、または末尾改行欠落 | Vercel に登録するときに JSON を 1 行のまま貼り、`\n` をそのまま残す |
| `get_supabase_logs` で 401 | `SUPABASE_MANAGEMENT_TOKEN` 未設定 / 期限切れ | 再発行 |
| `get_supabase_logs` で 404 | Supabase Management API のエンドポイント仕様変更 (`/v1/projects/.../analytics/endpoints/logs.all` が現在 404) | **既知の課題**。当面は Supabase ダッシュボードから直接確認してください。Advisor 側の対応は後日検討 (TODO) |
| `get_vercel_logs` が別プロジェクトのデプロイを返す | `VERCEL_PROJECT_ID` 未設定でアカウント全体から検索される | tastas プロジェクトの ID を `VERCEL_PROJECT_ID` に設定 |
| ストリーミング応答が止まる | SSE バッファリング (修正済) | Vercel ログで `[advisor]` を grep |
| デプロイ自体が失敗 | ビルドエラー | Vercel デプロイログを確認、開発者に共有 |
| 公開シェア URL が即 404 | `share_token` カラム未追加 / 期限切れ / token 漏れによる cron での失効 | DB 確認 (`SELECT shared_at, shared_until FROM advisor_report_versions WHERE share_token=?`)、必要なら再有効化 |
| 共有 URL を開いてもデータが見えない | `app/advisor/r/[token]/page.tsx` の認証ガードが働いてしまう | `middleware.ts` の `publicRoutes` に `/advisor/r/` が含まれているか確認 |
| Canvas を開いてもドラフトが反映されない | DB に `metric_keys` / `original_request` / `skeleton_markdown` カラムがない | STEP 1 の dry-run + 本実行を再確認 |
| しおりアイコンが押せない / 状態が保存されない | `bookmarked` カラム未追加 | STEP 1 の dry-run + 本実行を再確認 |
| `advisor-cleanup` cron 実行で 401 | `ADVISOR_CRON_SECRET` 未設定 | Vercel 環境変数を確認 |
| `advisor-cleanup` cron で大量削除されてしまった | しおりを付け忘れていた | 30 日以内に発覚すれば DB バックアップから復旧可。原則しおりを ON にしておく運用 |
| Advisor のチャットで「先月のレポートで言ってた○○」と聞いても答えてくれない | (1) `advisor_semantic_memory` テーブル未作成 / (2) しおり未設定 / (3) `advisor-semantic-ingest` cron 未実行 | (1) STEP 1 dry-run で確認 / (2) 該当セッションのしおりを ON / (3) STEP 7-3 の curl コマンドで手動トリガー |
| `advisor-semantic-ingest` cron で 401 | `ADVISOR_CRON_SECRET` 未設定 / 不一致 | Vercel 環境変数を確認 (`advisor-cleanup` と同じ値を使う) |

---

## 8. ロールバック手順 (緊急時)

### 8-1. Advisor 機能だけ無効化したい場合 (推奨)

Vercel 環境変数に `ADVISOR_ENABLED=false` を追加して Redeploy。
`/system-admin/advisor` にアクセスすると 503 を返すようになります。
他機能には影響なし。

### 8-2. デプロイそのものを巻き戻したい場合

Vercel ダッシュボード → Deployments で **直前のステージングデプロイ** を「Promote to Production」相当の操作で戻す
(ステージングなので "Rollback to this deployment")。

### 8-3. DB を巻き戻したい場合

Advisor 関連テーブルのみを DROP:
```sql
DROP TABLE IF EXISTS advisor_semantic_memory CASCADE;
DROP TABLE IF EXISTS advisor_report_versions CASCADE;
DROP TABLE IF EXISTS advisor_report_drafts CASCADE;
DROP TABLE IF EXISTS advisor_settings CASCADE;
DROP TABLE IF EXISTS advisor_usage_daily CASCADE;
DROP TABLE IF EXISTS advisor_saved_prompts CASCADE;
DROP TABLE IF EXISTS advisor_knowledge_sync_logs CASCADE;
DROP TABLE IF EXISTS advisor_knowledge_cache CASCADE;
DROP TABLE IF EXISTS advisor_audit_logs CASCADE;
DROP TABLE IF EXISTS advisor_chat_messages CASCADE;
DROP TABLE IF EXISTS advisor_chat_sessions CASCADE;
```

> 本体テーブルは絶対に DROP しないこと。Advisor 関連テーブル (11 個) のみ。

---

## 9. 関連ドキュメント (詳細を知りたい場合)

| ファイル | 内容 |
|---|---|
| [HANDOFF.md](./HANDOFF.md) | 開発者用の引き継ぎ資料。最新ステータス・タスク一覧 |
| [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) | デプロイ系のチェックボックス管理 |
| [P1_SPEC.md](./P1_SPEC.md) | 今回展開する P1 機能 8 項目の仕様 |
| [REPORT_FEATURE.md](./REPORT_FEATURE.md) | Canvas + レポート機能の独立サマリ |
| [SETUP.md](./SETUP.md) | ローカル開発環境セットアップ |
| [architecture.md](./architecture.md) | システム構成の俯瞰 |
| [data-model.md](./data-model.md) | Prisma スキーマ詳解 |
| [tools-spec.md](./tools-spec.md) | ツール 18 個の仕様 |
| [security-cost.md](./security-cost.md) | セキュリティ・コスト設計 |

---

## 10. 質問・連絡先

- 開発者: 川島 (ichiro0712@gmail.com / GitHub: @ichiro0712-dotcom)
- 不明点・詰まったら **STEP を進めずに連絡** してください
