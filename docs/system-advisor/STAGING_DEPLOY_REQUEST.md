# 【システム責任者向け】 System Advisor ステージング展開作業依頼

**作成日**: 2026-05-01
**対象環境**: ステージング (https://stg-share-worker.vercel.app)
**対象ブランチ**: `feature/system-advisor-chatbot` → `develop` へ PR でマージ予定
**所要時間目安**: 60〜90 分 (待機時間含む)

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
| **新規 DB テーブル** | 10 個 (Advisor 関連、本体テーブルは触らない) |
| **新規 Vercel 環境変数** | 10 個 (Anthropic / GitHub / Supabase / Search Console / Google Chat 等) |
| **コード追加** | 96 ファイル / +15,506 行 (ほぼ全て `src/lib/advisor/`, `app/system-admin/advisor/`, `docs/system-advisor/` 配下) |

### Advisor の主な機能

- LLM チャット (Anthropic Claude 4.5/4.6/Opus 切替可)
- ツール 18 個 (DB 集計 / GA4 / Search Console / Vercel/Supabase ログ / コードベース検索 / ドキュメント検索)
- レポート機能 (Anthropic で要件固め → Gemini で本文生成)
- レポートのバージョン管理 (生成 / 手動編集 / AI 部分修正の履歴)
- レポートの Google Chat 配信
- 設定ページ (ラリー回数 / プロンプト編集 / データソース一覧 / 月次使用統計)

---

## 2. 事前準備 (作業者側で揃えるもの)

| # | 必要なもの | 取得方法 |
|---|---|---|
| 1 | **Vercel ダッシュボードへのアクセス** | tastas プロジェクトの Settings 編集権限 |
| 2 | **Supabase ステージングプロジェクトへのアクセス** | プロジェクト ID `qcovuuqxyihbpjlgccxz`、SQL Editor 編集権限 |
| 3 | **Supabase 本番プロジェクトへのアクセス** | プロジェクト ID `ryvyuxomiqcgkspmpltk` (読み取り専用ロール作成のため) |
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

期待される出力: 以下 **10 個の `CREATE TABLE`** が含まれること

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

> 🚨 **`DROP TABLE`、`ALTER TABLE ... DROP COLUMN`、`DROP INDEX` 等の破壊的 SQL が出てきたら即中止して開発者 (川島) に連絡してください。**

> なお、本番 DB に既に存在しているテーブル (`recommended_jobs`, `public_job_page_views`,
> `job_search_page_views`, `job_detail_page_views`, `registration_page_views`,
> `application_click_events`, `form_destinations`) はステージングでも反映済みなので追加されません。

#### 1-2. 本実行

dry-run で 10 個の CREATE TABLE のみだと確認後:

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

---

### STEP 2: 本番 Supabase に読み取り専用ロールを作成 ☑ (既に完了済み・作業不要)

> Advisor は **本番 Supabase の業務データを「読み取り専用」で参照する** ため、`advisor_readonly` 専用ロールを使います。
> このロールには `SELECT` 権限のみ付与し、`INSERT`/`UPDATE`/`DELETE` は禁止しています。
>
> 🟢 **このロールは既に作成済み** です。ローカル開発環境から `advisor_readonly` 経由で
> 本番 Supabase の業務データ読み取りができていることを開発者 (川島) が確認済み (2026-05-01)。
>
> **STEP 2 はスキップしてください**。STEP 3 で接続文字列を Vercel 環境変数に渡すだけで、
> ステージング環境からも同じロールで本番 Supabase の業務データが読めるようになります。

> ⚠️ ステージング展開でも、Advisor は **本番 Supabase の現実値を参照する設計** です。
> (ステージング DB に本番データのコピーが無く、Advisor の「現在公開中の求人は何件?」のような
> 質問に意味のある答えを返すため。)
>
> **接続文字列 (`ADVISOR_DATA_DATABASE_URL`) は開発者 (川島) の `.env.local` に既にあります**。
> Vercel に登録するときも同じ文字列を流用してください。新規発行は不要。

#### 参考: 過去にロールを作成したときの SQL (再実行不要・記録のみ)

#### 2-1. 本番 Supabase の SQL Editor で以下を実行

```sql
-- パスワードは強力なものを生成 (例: openssl rand -base64 32 で生成)
-- 生成したパスワードは後で Vercel 環境変数 ADVISOR_DATA_DATABASE_URL に使う
CREATE ROLE advisor_readonly WITH LOGIN PASSWORD 'GENERATED_STRONG_PASSWORD';

-- public スキーマ全テーブルの SELECT 権限のみ付与
GRANT USAGE ON SCHEMA public TO advisor_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO advisor_readonly;

-- 今後追加されるテーブルにも自動で SELECT 権限を付与
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO advisor_readonly;

-- 念のため書き込み系を明示的に剥奪 (デフォルトで無いはずだが安全のため)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM advisor_readonly;
```

#### 2-2. 接続文字列の作成

Supabase ダッシュボード → Settings → Database → Connection string で **Session Pooler モード** の接続文字列を取得し、ユーザー名・パスワードを置き換える:

```
postgresql://advisor_readonly.ryvyuxomiqcgkspmpltk:GENERATED_STRONG_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

> パスワードに URL 特殊文字 (`@` `:` `/` `?` `#` `[` `]` 等) が含まれる場合は **`encodeURIComponent` でエンコード** してから使う。

#### 2-3. 動作確認 (任意)

`psql` で接続して `SELECT count(*) FROM "User";` などが返るが、`INSERT INTO "User" ...` が
permission denied で失敗することを確認。

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

> **既存変数の流用**: `GA_CREDENTIALS_JSON` は既存のものを Search Console でも流用するため新規追加不要。
> ただし、その Service Account のメールアドレスを Search Console プロパティに **「制限付きユーザー」以上** で追加する必要あり (STEP 4)。

> **`ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` の取得方法**:
> 1. 配信先にしたい Google Chat スペースを開く
> 2. スペース名右側の▼ → 「アプリと統合」 → 「Webhook を追加」
> 3. 名前 (例: "TASTAS Advisor")、アイコン URL (任意) を設定
> 4. 「保存」 → 表示された URL をコピー

#### 動作確認

- [ ] Vercel ダッシュボードで 11 個の環境変数が **Preview 環境** に追加されている
- [ ] `ANTHROPIC_API_KEY` が `sk-ant-api03-` で始まる正しい形式
- [ ] `ADVISOR_DATA_DATABASE_URL` の URL 中で特殊文字が `%XX` 形式にエンコードされている

---

### STEP 4: Search Console に Service Account を追加 ☐

> Service Account のメールアドレスは `GA_CREDENTIALS_JSON` の中の `client_email` フィールド
> (例: `tastas-ga-reader@xxx.iam.gserviceaccount.com`) です。Vercel の環境変数を JSON 化して取り出すか、
> 元の JSON ファイルを参照してください。

#### 4-1. 手順

1. [Google Search Console](https://search.google.com/search-console) を開く
2. プロパティ `sc-domain:tastas.work` (または `https://tastas.work/`) を選択
3. 設定 → ユーザーと権限 → ユーザーを追加
4. メールアドレス: GA4 で使っている Service Account の `client_email`
5. 権限: **「制限付き」** (= 閲覧のみ。これで十分)
6. 追加

#### 4-2. 動作確認

ローカルで以下のスクリプトでテストできる (Vercel デプロイ後でも OK):

```bash
# Vercel デプロイ後に確認する場合は、Vercel の Function Log を見る方が早い
# (ステージング動作確認 §STEP 6 で確認するので、ここは飛ばしてもよい)
```

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
| 9 | レポート生成後、結果ビューの「Chat に送信」ボタン | Google Chat スペースにレポートが届く |
| 10 | 結果ビューの「編集」ボタン → 本文を直接編集 → 「保存」 | 新しいバージョン (v2) として保存される |
| 11 | チャットで「○章を簡潔に」と依頼 | `edit_report_section` ツールで部分修正版 (v3) が作られる |
| 12 | サイドバー下部「レポート履歴」リンク | `/system-admin/advisor/reports` で全バージョン一覧 |
| 13 | ヘッダー右上の歯車アイコン | `/system-admin/advisor/settings` で設定ページ |
| 14 | DevTools Console で `[advisor] heartbeat:` ログ | 5 秒ごとに heartbeat イベントが届いている |

🐛 **不具合があれば本番展開前に修正**します (本ドキュメントは差し戻し OK)。

---

### STEP 7: 知識同期 cron の手動実行 ☐

> 知識同期 cron は GitHub から CLAUDE.md / docs / Prisma schema を取得して
> Advisor の `advisor_knowledge_cache` テーブルに保存します。

#### 7-1. 手動トリガー

```bash
curl -X POST https://stg-share-worker.vercel.app/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

期待: HTTP 200 + `{ "synced": <件数> }` のような JSON 応答。

#### 7-2. Vercel Cron 設定 (定期実行)

`vercel.json` に既に cron 定義が入っています (もしなければ Vercel ダッシュボード →
Settings → Cron Jobs で確認)。週 1 回程度で十分。

---

## 4. 完了報告フォーマット

全 STEP 終わったら開発者 (川島) に以下を報告:

```
【ステージング展開完了】
- STEP 1 (DB): 10 テーブル全て作成確認 ☑
- STEP 2 (本番ロール): 既に過去に作成済み、新規作業なし ☑ (川島確認済み 2026-05-01)
- STEP 3 (Vercel 環境変数): 14 個全て追加 ☑ (Hobby プランなら VERCEL_TEAM_ID 除く 13 個)
- STEP 4 (Search Console): Service Account を property に追加 ☑
- STEP 5 (GitHub PR + マージ): #XXX マージ済 ☑
- STEP 6 (動作確認): 14 項目全てパス (確認担当: 川島) ☑
- STEP 7 (知識同期 cron): 200 で同期完了確認 ☑

問題なし → 本番展開判断を待ちます
```

---

## 5. 環境変数一覧 (再掲・コピペ用)

```bash
# === 必須 14 個 ===
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

# === 既存流用 (新規追加不要) ===
# GA_CREDENTIALS_JSON  ← GA4 で既に使用中、Search Console でも流用
# DATABASE_URL         ← ステージング Supabase 既存設定
```

---

## 6. データ・トラフィックの想定

### Anthropic コスト (ステージング)

- 想定使用者: System Admin 数名
- 1 セッション: 5〜20 ターン、平均 5K input + 2K output トークン
- 1 セッション約 ¢2〜10 (USD)
- 1 日 5 セッションでも $0.50/日 程度
- **暴走対策**: ループ上限 20 (設定ページで変更可)、レート制限 (1h 60 req / 1d 500 req per admin)

### Gemini コスト (レポート生成)

- gemini-2.5-flash 使用 (安価)
- 1 レポート ≈ ¢0.5〜2 (USD)
- 1 日 5 レポートでも $0.10/日 程度

### DB 容量

- `advisor_audit_logs` が一番増える (1 ターン = 数行)
- 想定: 1 日 100 行 × 365 日 = 4 万行/年 (容量負担は無視できる)

---

## 7. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `/system-admin/advisor` で 503 | `ANTHROPIC_API_KEY` 未設定 | Vercel 環境変数を確認 → Redeploy |
| Anthropic 401 invalid x-api-key | キー revoke / 残高 0 / typo | キー再発行・残高確認 |
| `query_metric` で permission denied | `advisor_readonly` ロールの GRANT 漏れ | STEP 2 の SQL を再実行 |
| `query_search_console` で 403 | Service Account を property に未追加 | STEP 4 を実施 |
| `get_supabase_logs` で 401 | `SUPABASE_MANAGEMENT_TOKEN` 未設定 / 期限切れ | 再発行 |
| `get_supabase_logs` で 404 | Supabase Management API のエンドポイント仕様変更 (`/v1/projects/.../analytics/endpoints/logs.all` が現在 404) | **既知の課題**。当面は Supabase ダッシュボードから直接確認してください。Advisor 側の対応は後日検討 (TODO) |
| `get_vercel_logs` が別プロジェクトのデプロイを返す | `VERCEL_PROJECT_ID` 未設定でアカウント全体から検索される | tastas プロジェクトの ID を `VERCEL_PROJECT_ID` に設定 |
| Google Chat 配信で 400 | Webhook URL の typo / Webhook が削除されている | URL を再取得 |
| ストリーミング応答が止まる | SSE バッファリング (修正済) | Vercel ログで `[advisor]` を grep |
| デプロイ自体が失敗 | ビルドエラー | Vercel デプロイログを確認、開発者に共有 |

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

> 本体テーブルは絶対に DROP しないこと。Advisor 関連テーブル (10 個) のみ。

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
