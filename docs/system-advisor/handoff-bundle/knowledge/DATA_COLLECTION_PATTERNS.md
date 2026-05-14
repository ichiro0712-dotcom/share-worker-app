# DATA_COLLECTION_PATTERNS — collect.ts の教訓

**作成**: 2026-05-04
**目的**: レポート生成時のデータ収集 (`reports/collect.ts`) で得た教訓を記録。

---

## 1. ツールの能力を「フル展開」する設計

### 事故例
`query_ga4` を `report_type: 'overview'` 1 種だけで呼んでいた → 流入経路 / ページ別 PV のデータが渡されず、Gemini が「データがない」と書く。

### 対策
ツール側に enum (reportType / dimensions / source / level / env など) がある場合、**レポート用 collect ではデフォルトで全展開する**。

### 現在の展開状況 (2026-05-04 時点)

| ツール | 展開数 | 内容 |
|---|---|---|
| `query_metric` | metric × supportedGroupBy | 例: LP_PV → none/day/lp_id/campaign_code の 4 種 |
| `query_ga4` | 5 | overview / traffic / pages / lpPerformance / comparison |
| `query_search_console` | 4 | dimensions=[query] / [page] / [device] / [country] |
| `get_supabase_logs` | 3 | postgres / api / auth |
| `get_vercel_logs` | 3 | error / warning / info |
| `get_vercel_deployments` | 2 | production / preview |

### 副作用と根拠
- `Promise.all` で並列実行なので**所要時間は最遅リクエストで律速** = 体感速度変わらず
- 1 レポートあたりのリクエスト数は増えるが、API クォータの範囲内
- データ量が増えるので 各ツール出力は **50KB 切り詰め** で対処

実装: `src/lib/advisor/reports/collect.ts` `buildInputFor()`

---

## 2. 過去バージョンの手作業修正を継承

### 事故例
ユーザーが result v3 で「日付フォーマットを MM/DD に」修正 → auto-redraft で再生成すると元に戻る。

### 真因
`generate.ts` が skeleton + collected_data から完全新規生成していた (前バージョンを見ていない)。

### 対策
`previousResultMarkdown` を Gemini に渡し、システムプロンプトに以下を追加:
> **最重要ルール 1: 前回バージョンの編集スタイルを絶対維持**

実装: `src/lib/advisor/reports/generate.ts` で `getLatestVersion()` から取得して Gemini プロンプトに含める

---

## 3. 出力サイズの 50KB cap

各ツールの戻り値 (JSON) が大きくなる場合、**50,000 文字で truncate** してから Gemini に渡す。

### 理由
- Gemini の context window は数 M トークンあるが、過剰な context は応答品質を下げる + コスト増
- 50KB あれば大抵の集計データは収まる
- truncate されたツールには `truncated: true` を metadata に流して LLM に明示

実装: `src/lib/advisor/reports/collect.ts`

---

## 4. データソース ↔ ツール ↔ 期間表記のマッピング

レポート生成プロンプトで「どのツールの結果がどの期間か」を明確にするため、表記マッピング表を維持:

| データソース key | 出典ラベル (UI) | 期間表記 |
|---|---|---|
| `query_metric` | 本番 DB 指標集計 | `YYYY-MM-DD 〜 YYYY-MM-DD (JST)` |
| `query_ga4` | GA4 アクセス解析 | 同上 |
| `query_ga4 (comparison)` | GA4 アクセス解析 | `今期: ○ 〜 ○ / 前期: ○ 〜 ○ (JST)` |
| `query_search_console` | Search Console | `YYYY-MM-DD 〜 YYYY-MM-DD (JST)` |
| `get_jobs_summary` | 求人サマリ | `現時点スナップショット (取得: YYYY-MM-DD HH:MM JST)` |
| `get_users_summary` | ユーザーサマリ | 同上 |
| `get_recent_errors` | エラーログ (DB) | `直近 N 件` (limit 値) |
| `get_supabase_logs` | Supabase ログ | `直近 24 時間` |
| `get_vercel_logs` | Vercel ログ | `直近 N 件 (level=error/warning/info)` |
| `get_vercel_deployments` | Vercel デプロイ履歴 | `直近 N 件 (env=production/preview)` |
| `get_recent_commits` | GitHub コミット履歴 | `直近 30 件` |

実装: `src/lib/advisor/tool-source-labels.ts` + Gemini プロンプト ([generate.ts](../src/lib/advisor/reports/generate.ts))

---

## 5. 並列実行の上限

`Promise.all` で全データソースを並列実行するが、**Gemini API のレート制限** (Google AI Studio Free tier だと 15 req/min) には注意。

現状 1 レポート生成で:
- `collect.ts`: 各種 GA / Search Console / Supabase / Vercel 等 → 全部並列で 10〜20 req
- `generate.ts`: Gemini 1 回呼び出し

レート制限に引っかかるなら段階的に並列度を下げる (現状未実装、要監視)。

---

## 関連ドキュメント

- [DESIGN_DECISIONS.md §2.3](./DESIGN_DECISIONS.md) — ツール能力フル展開設計の意図
- [PROMPT_PATTERNS.md §7](./PROMPT_PATTERNS.md) — データソース日本語ラベル統一
- 実コード: `src/lib/advisor/reports/collect.ts` / `src/lib/advisor/reports/generate.ts`
