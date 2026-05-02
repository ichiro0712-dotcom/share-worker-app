# Advisor デプロイ前 / デプロイ時 やることリスト

> **このファイルは "セッションをまたいで残るタスクリスト" です。**
> やったことは ☑ にチェックを入れる。やってないものは ☐ のまま残す。
> 完了して取り消し線付きで残すと履歴になって便利。

最終更新: 2026-05-01

---

## ⚠️ デプロイ前に必ず読むこと

- **GitHub 関連 (commit/push/PR/マージ) はこのリストの範囲外** (HANDOFF.md / CLAUDE.md を参照)
- **Vercel 環境変数の CLI 操作禁止** — ダッシュボードから手動追加 (CLAUDE.md ルール)
- **本番 DB への直接 Prisma コマンドは Claude Code 実行禁止** — ユーザーが手で叩く
- 各タスクには「ステージング / 本番」の区別あり。**先にステージングで動作確認してから本番に進む**

---

## 1. ステージング展開時

### 1-1. ステージング DB スキーマ反映 ☐

**目的**: Advisor 機能用の 8 テーブルをステージング Supabase に作成

**事前確認 (dry-run, 必須)**:
```bash
# ステージングの DATABASE_URL に置き換えてから実行
DATABASE_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
  npx prisma migrate diff \
    --from-schema-datamodel prisma/schema.prisma \
    --to-url "$DATABASE_URL" \
    --script
```

出力で以下 10 個の `CREATE TABLE` 文だけが含まれていることを確認:
- `advisor_chat_sessions`
- `advisor_chat_messages`
- `advisor_audit_logs`
- `advisor_knowledge_cache`
- `advisor_knowledge_sync_logs`
- `advisor_saved_prompts`
- `advisor_usage_daily`
- `advisor_report_drafts`
- `advisor_settings` ← **v2 追加** (設定ページ用シングルトン)
- `advisor_report_versions` ← **P1 追加** (レポートのバージョン履歴)

加えて以下のカラム追加もあります:
- `advisor_report_drafts.metric_keys` (Json?, P1-6)

🚨 もし `DROP TABLE`、`ALTER TABLE ... DROP COLUMN`、`DROP INDEX` 等の破壊的 SQL が出てきたら **即中止して相談**。

**本コマンド (CREATE のみ確認後に実行)**:
```bash
DATABASE_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
DIRECT_URL="postgresql://postgres:STAGING_PW@db.qcovuuqxyihbpjlgccxz.supabase.co:5432/postgres" \
  npx prisma db push
```

🔍 完了確認 (Advisor 経由でステージング DB を読める接続があれば):
```bash
npx tsx scripts/check-prod-tables.ts
```

(現状このスクリプトは本番DB を見ているので、ステージング用に別途 DSN を切替えて実行)

---

### 1-2. ステージング Vercel 環境変数追加 ☐

**手順**: https://vercel.com/dashboard → tastas プロジェクト → Settings → Environment Variables → **Preview** 環境に追加

| 変数名 | 値 | 備考 |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-XXXX` (実値は別途共有) | 動作確認済みキー |
| `GITHUB_TOKEN_FOR_ADVISOR` | `ghp_...` | 既存 GITHUB_TOKEN とは別の Advisor 専用 PAT |
| `ADVISOR_GITHUB_OWNER` | `ichiro0712-dotcom` | |
| `ADVISOR_GITHUB_REPO` | `share-worker-app` | |
| `ADVISOR_CRON_SECRET` | (32+文字ランダム、実値は別途共有) | 自動生成済み (`.env.local` 参照) |
| `ADVISOR_DATA_DATABASE_URL` | `postgresql://advisor_readonly:...@db.ryvyuxomiqcgkspmpltk....` | 本番Supabase 読取専用 (ステージングからも本番データ参照可) |
| `SUPABASE_MANAGEMENT_TOKEN` | `sbp_...` | |
| `SUPABASE_PROJECT_REF` | `ryvyuxomiqcgkspmpltk` | 本番プロジェクト ref |

⚠️ **追加後 Redeploy 必須** (Vercel ダッシュボードの Deployments → 最新を Redeploy)

---

### 1-3. ステージング動作確認 ☐

ステージング URL: https://stg-share-worker.vercel.app

確認項目:
- [ ] `/system-admin/login` にログインできる
- [ ] `/system-admin/advisor` が表示される
- [ ] 「こんにちは」 → 通常応答
- [ ] 「現在公開中の求人は何件?」 → `query_metric` で本番Supabase 値が返る
- [ ] 「Job テーブルにはどんなカラム?」 → `describe_db_table` 動作
- [ ] 「先週のGA4セッション数」 → `query_ga4` 動作
- [ ] 「Supabase直近1時間のログ」 → `get_supabase_logs` 動作
- [ ] DevTools Console で `[advisor] heartbeat` ログが 5 秒ごとに出る
- [ ] 50 秒以上の長尺応答でも文字が止まらない (SSE バッファ問題未再発)
- [ ] チャット履歴一覧 (`/system-admin/advisor/history`) が動く

🐛 不具合あれば main 反映前に修正。

---

### 1-4. ステージング知識同期 cron 動作確認 ☐

GitHub から CLAUDE.md / docs / schema を Advisor の知識キャッシュに同期する cron。

```bash
curl -X POST https://stg-share-worker.vercel.app/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

期待: 200 + 同期した件数を含むレスポンス。Vercel の cron 設定でも自動実行スケジュールが組まれているか確認。

---

## 2. 本番展開時

### 2-1. 本番 DB スキーマ反映 ☐

**🚨 最重要**: 必ずバックアップ取得後 / dry-run 確認後に実行。

**事前確認 (dry-run)**:
```bash
DATABASE_URL="postgresql://postgres:PROD_PW@db.ryvyuxomiqcgkspmpltk.supabase.co:5432/postgres" \
  npx prisma migrate diff \
    --from-schema-datamodel prisma/schema.prisma \
    --to-url "$DATABASE_URL" \
    --script
```

8 個の `CREATE TABLE` のみが出ることを確認。

**バックアップ取得**: Supabase ダッシュボード → 本番 → Database → Backups で manual backup を実行。

**本コマンド**:
```bash
DATABASE_URL="postgresql://postgres:PROD_PW@db.ryvyuxomiqcgkspmpltk.supabase.co:5432/postgres" \
DIRECT_URL="postgresql://postgres:PROD_PW@db.ryvyuxomiqcgkspmpltk.supabase.co:5432/postgres" \
  npx prisma db push
```

🔍 完了確認:
```bash
npx tsx scripts/check-prod-tables.ts
```

15/15 全て ✅ になることを確認。

---

### 2-2. 本番 Vercel 環境変数追加 ☐

**手順**: https://vercel.com/dashboard → tastas プロジェクト → Settings → Environment Variables → **Production** 環境に追加

ステージングと同じ 8 変数 (1-2 の表参照)。

⚠️ **追加後 Redeploy 必須**

---

### 2-3. 本番動作確認 ☐

本番 URL: https://tastas.work

ステージングと同じ動作確認 (1-3 の項目をすべて) を **本番** で実施。

特に注意:
- [ ] 本番ユーザーには影響なし (Advisor は `/system-admin/advisor` のみ。一般ユーザーは触れない)
- [ ] 本番 DB への書き込みが起きていない (Supabase ダッシュボードで `advisor_chat_sessions` 等にレコード追加されることは正常。それ以外の TASTAS テーブルは触らない想定)
- [ ] 監査ログが残る (`advisor_audit_logs` に chat_request / chat_response / tool_call が記録される)

---

### 2-4. 本番知識同期 cron 動作確認 ☐

```bash
curl -X POST https://tastas.work/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

---

## 3. デプロイ後の安定化フェーズ (1〜7日)

### 3-1. 使用量モニタリング ☐

- [ ] Anthropic Console で 日次使用量チェック (https://console.anthropic.com/settings/billing)
- [ ] `advisor_usage_daily` テーブルでトークン消費を毎日確認
- [ ] 想定外の高コストになっていないか (1日 $5 以上なら一旦調査)

### 3-2. レート制限の調整 ☐

- 1時間 60req / 1日 500req が現実的か検証
- Advisor 用 System Admin が 5 名以上いる場合は要見直し

### 3-3. ログ・監査確認 ☐

- [ ] `advisor_audit_logs` で `error` イベントが多発していないか
- [ ] Anthropic 401 などの再発がないか
- [ ] Vercel の Function Logs で `[advisor]` 系のエラーがないか

---

## 4. 完了後の片付け ☐

### 4-1. `_legacy_agent-hub/` 物理削除

ステージング・本番ともに動作確認済みになったら:
```bash
rm -rf _legacy_agent-hub
git status  # ".gitignore" 化済みなので何も検出しないはず
```

すでに `.gitignore` 化済みなので git 履歴には影響しない。1.4GB のディスク領域が解放される。

### 4-2. ローカル開発時のフォールバック動作の見直し ☐

ローカルから本番DB を直接見る運用が続く場合、`ADVISOR_DATA_DATABASE_URL` をローカル `.env.local` に残すか判断:
- 残す → ローカルでも本番値が見える (便利だが事故リスク)
- 削除 → ローカルは Docker DB にフォールバック (安全だが値が現実とズレる)

---

## 5. 緊急時のロールバック手順

### Advisor が暴走した・コスト爆発した場合

1. Vercel ダッシュボードで `ADVISOR_ENABLED=false` 環境変数を追加 (route.ts の `isAdvisorEnabled()` で 503 を返す)
2. Redeploy
3. `/system-admin/advisor` にアクセスすると "Advisor は現在無効化されています" になる

(2026-05-01 時点で `isAdvisorEnabled()` のロジックが `ADVISOR_ENABLED` を読んでいるか要確認 — まだ実装漏れの可能性あり)

### DB スキーマで問題が起きた場合

1. Supabase ダッシュボード → Database → Backups から復元
2. または手動で問題テーブルを `DROP TABLE advisor_xxx;` (Advisor テーブルのみ。本体テーブルは絶対に触らない)

---

## チェックリスト運用ルール

- ✅ 完了したら ☐ → ☑ または `[x]` に変更
- 📌 やる順序: 1 → 2 → 3 (ステージング → 本番 → 安定化)
- 🚫 飛ばし禁止: ステージング動作確認(1-3) なしで本番 DB push (2-1) は厳禁
- 🔄 セッションをまたいでも消えないので、Claude Code が新セッションで読み込んだら現状把握できる
- 📝 完了/失敗の経緯は HANDOFF.md のセッションログに残す
