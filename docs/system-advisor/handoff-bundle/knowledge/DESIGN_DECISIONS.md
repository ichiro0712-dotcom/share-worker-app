# DESIGN_DECISIONS — なぜこの設計か

**作成**: 2026-05-04
**目的**: TASTAS Advisor で「**意図的に**選んだ設計判断」を記録。
hub-platform 側で advisor-core 抽出時に「これは何故こうなってる?」と思った時に
**まずここを読む**。

⚠️ **絶対ルール**: 本ファイルに書かれた判断を **理由を理解せずに変更しない**。
変更する場合は新しい決定理由を本ファイル末尾に追記すること。

---

## 1. LLM 選択 / 役割分担

### 1.1 Anthropic + Gemini の二本立て

| 用途 | モデル | 理由 |
|---|---|---|
| 一般チャット (質疑 / ツール選択 / 通常応答) | **Anthropic Claude Sonnet 4.6** | tool use の精度が高い、対話品質が高い |
| ドラフト初回作成 (`[TOOL:report_create]`) | **Gemini 2.5 Flash 直叩き** | 構造化 JSON 出力が安定、Anthropic loop=1 TTFB 100s 問題回避 |
| ドラフト修正 (`[TOOL:draft_revise]`) | **Gemini 2.5 Flash 直叩き** | 同上 |
| レポート本文生成 (`/api/advisor/report/generate`) | **Gemini 2.5 Flash** | 長文 + 構造化 + 数値表埋めに強い |
| レポート部分編集 (`[TOOL:result_edit]`) | **Gemini 2.5 Flash 直叩き** | stateless で速い、部分書き換えに強い |

#### 真因 (これを理解しないと正しい判断ができない)

**2026-05-03 のジッター分析** (`scripts/advisor-jitter-analysis.ts`) で判明:
- Anthropic loop=1 (= ツール実行後の最終応答) で TTFB が 90〜130 秒になる事象が頻発
- 遅い 7 件すべてが loop=1 で、cacheRead 中央値 60,898 tokens (キャッシュは効いている)
- cacheCreate 中央値 493 tokens (完全な再計算ではない)
- 速かった 2 件 (TTFB 1〜2 秒) は同一セッション内の連続リクエストのみ
- → **Anthropic 側のロードバランサーがキャッシュ KV を持つノードと別ノードにルーティング** し、
  リハイドレーション (中央ストアから VRAM への物理転送) で 90〜130 秒待たされている
- → **こちら側では制御不能**

#### 否定された対策

| 試した対策 | 結果 |
|---|---|
| TTL 5 分切れの仮説 | × cacheCreate 中央値 493 (完全再計算なら 50K+ になるはず) |
| ランダム揺らぎの仮説 | × 7 件全て loop=1 に集中 (ランダムなら散らばる) |
| Sonnet 4 → Sonnet 4.6 切替 | × 効果なし |
| `thinking: { type: 'disabled' }` 明示 | × 効果なし |
| prompt cache 化 | × cache は効いているのに遅い |
| dynamic prompt 化 (skeleton 末尾移動) | × 効果なし |
| `max_tokens=512` 制限 | × 効果なし |

#### 採用した対策: Gemini にバイパス

ユーザー入力先頭の hidden hint で `orchestrator` が分岐:
```typescript
if (trimmed.startsWith('[TOOL:report_create]'))   → Gemini ルート (createDraftWithGemini)
if (trimmed.startsWith('[TOOL:draft_revise]'))    → Gemini ルート (editDraftWithGemini)
if (trimmed.startsWith('[TOOL:result_edit]'))     → Gemini ルート (editResultWithGemini)
それ以外                                            → 通常の Anthropic ツールループ
```

実装: [src/lib/advisor/orchestrator.ts:344-368](../src/lib/advisor/orchestrator.ts)

#### Phase 別の TTFB 改善履歴

| Phase | 対応 | TTFB |
|---|---|---|
| 初期 | Anthropic loop=1 で update_report_draft → 複数 round trip | 100 秒級 |
| Phase A | `[TOOL:draft_revise]` を Gemini 直叩き化 | 4-10 秒 |
| Phase B | `[TOOL:report_create]` も Gemini 直叩き化 | 9 秒前後 |
| Phase C | `[TOOL:result_edit]` 経路新設 | 5-10 秒 |
| Phase D | auto-redraft (result_edit → draft_revise → 再生成) 自動化 | 40 秒前後 (3 段階の合計) |

詳細: [LATENCY_HISTORY.md](./LATENCY_HISTORY.md)

### 1.2 Anthropic フォールバックの撤去

#### 初期設計
Gemini バイパス失敗 → Anthropic に fall through (堅牢性優先)

#### 問題発生
Anthropic loop=1 で結局 100 秒級になり、ユーザーが 2 分待たされて結局答えが返らない最悪 UX

#### 現在 (絶対遵守)
**Gemini 失敗 → 即時 `error` イベント** で「失敗、再試行を」を 5-10 秒で返す

```
× Gemini 失敗 → Anthropic にフォールバック → 100 秒待たされる → 失敗
○ Gemini 失敗 → 即時エラー応答 (5-10 秒) → ユーザーが再試行判断
```

#### 例外
**前提条件 NG** (no draft / admin mismatch) のみ Anthropic に流す。
これらは Gemini を呼ぶ意味がないケース。

⚠️ **再発防止**: 「堅牢性のためにフォールバックを復活」は **絶対にやらない**。
[ANTI_PATTERNS.md §1](./ANTI_PATTERNS.md) に明記。

---

## 2. ツール設計の意図的判断

### 2.1 `list_available_metrics` 廃止

#### 背景
当初は LLM が「どんな指標があるか教えて」と `list_available_metrics` を呼ぶ → 結果を受けて `query_metric` を呼ぶ、の 2 段階だった。

#### 問題
- ツール往復が 1 回増える = TTFB が伸びる (Anthropic loop が +1 になる)
- METRIC_CATALOG は静的データなので、毎回問い合わせる意味がない

#### 採用判断
**system prompt の cachedPart に METRIC_CATALOG を Markdown 表として静的埋め込み**。
LLM は cache から「ここから選べ」と判断できる。

実装: [src/lib/advisor/system-prompt.ts](../src/lib/advisor/system-prompt.ts) の `buildMetricsCatalogSection()`

### 2.2 `get_report_draft` 廃止

#### 背景
LLM が `[TOOL:draft_revise]` を受けてドラフトを修正する時、現状ドラフトを取得するため `get_report_draft` を呼ぶ → 結果を受けて `update_report_draft` で書き戻す、の 2 段階だった。

#### 問題
- ツール往復で loop=1 が発生 → Anthropic の TTFB 100 秒問題に直撃
- ドラフトは **常に dynamic system prompt に埋まっている** ので往復不要

#### 採用判断
**dynamic system prompt の末尾に「現在のレポートドラフト状態」を毎回埋め込む**。
LLM は最初から context にドラフト全体を持っているので、`get_report_draft` を呼ぶ必要がない。

実装: [src/lib/advisor/system-prompt.ts](../src/lib/advisor/system-prompt.ts) の `dynamicPart` 構築

### 2.3 ツール能力の「フル展開」設計

`reports/collect.ts` で `data_sources` を並列に展開する際、**ツールに enum パラメータがあれば全パターン投げる**。

例:
- `query_ga4`: 5 種 (`overview` / `traffic` / `pages` / `lpPerformance` / `comparison`) を全部並列実行
- `query_search_console`: 4 種 (dimensions=[query] / [page] / [device] / [country])
- `query_metric`: metric × supportedGroupBy 全部 (LP_PV なら none/day/lp_id/campaign_code の 4 種)

#### 理由
過去の事故: query_ga4 を `report_type='overview'` だけで呼んでいた → 流入経路 / ページ別 PV のデータが渡らず、Gemini が「データがない」と書く

#### 副作用と根拠
- リクエスト数は増えるが API クォータ範囲内
- `Promise.all` 並列実行なので**所要時間は最遅リクエストで律速** = 体感速度変わらず
- データ量が増えるので 各ツール出力は **50KB 切り詰め** で対処

詳細: [DATA_COLLECTION_PATTERNS.md](./DATA_COLLECTION_PATTERNS.md)

---

## 3. プロンプト設計の意図的判断

### 3.1 「迷ったら更新する側に倒す」原則

#### 背景
revise (draft_revise) で skeleton に流入経路の表を追加したのに dataSources に query_ga4 が追加されず、レポート生成で空表になる事故

#### 真因
Gemini は「変更ないかも」と迷うと null (= 変更なし) を返しがち

#### 採用判断
プロンプトで以下を明示:
- **「迷ったら更新する側に倒す」**
- **「null を返してよいのは文言修正のみのとき」**

実装: [src/lib/advisor/llm/gemini-edit.ts](../src/lib/advisor/llm/gemini-edit.ts) のシステムプロンプト

### 3.2 「✅ / ❌ 具体例併記」原則

抽象的な禁止 (「自由に再構成してはいけない」) より、**「✅ こう書け / ❌ こう書くな」の具体例**を併記する方が遵守率が高い。

例: 表前置き散文の禁止
```markdown
❌ 例 (これを書かない):
## ワーカー TOP ページ PV 推移
今週のワーカー TOP ページの PV 数推移は以下の通りです。
| 日付 | PV |
...

✅ 正しい:
## ワーカー TOP ページ PV 推移

| 日付 | PV |
...
```

詳細: [PROMPT_PATTERNS.md](./PROMPT_PATTERNS.md)

### 3.3 ヘッダー型・章構成の固定強制は禁止

レポートは「主要 KPI 集計」「輪切り分析」「ad hoc 調査」「障害振り返り」など多様な用途で使う。
**「サマリ → 主要数値 → 次のアクション」の固定型を強制すると柔軟性を損なう**。
ユーザーが Canvas で作った skeleton をそのまま忠実に踏襲する原則。

### 3.4 ユーザーが指定したデータソースは絶対尊重

#### 事故例
ユーザー「**GTA から**取れる LP の PV ランキング」 → Gemini「LP_PV なら DB の query_metric で取れる」と判断 → query_metric を選択 (GA4 を使わず)

#### 対策
プロンプトに以下を明記:
> ユーザーが GA4 / GTA / アナリティクス / DB / Search Console / GitHub / Vercel / Supabase などを明示指定したら、その指定を絶対に尊重する。自動判断より明示指定を優先。

### 3.5 skeleton 段階での固有名禁止

#### 事故例
LLM がドラフト段階で「LP 5 (キラキラ介護転職 LP)」のような固有名を skeleton に書く → 実際にレポート生成時には DB に LP 名が無い (query_metric が name を取得していなかった) → 最終レポートに名前が出ず、ユーザーから「ID だけで意味分からない」と指摘

#### 真因
skeleton 段階では LandingPage / 求人 / キャンペーンの正式名称が分からない (まだデータ収集してない)

#### 採用判断 (2026-05-04)
1. プロンプトで「skeleton 段階で具体的 LP 名 / キャンペーン名 / 求人名を書かない」と明示
2. `query_metric` の戻り値に **`label?` フィールド**を追加し、本文生成時に `LandingPage.name` から `"LP 5 (キラキラ介護転職 LP)"` を解決
3. `generate.ts` プロンプトで「rows[].label を優先表示」と明示

実装: [src/lib/advisor/tools/tastas-data/query-metric.ts](../src/lib/advisor/tools/tastas-data/query-metric.ts) の `resolveLpLabels`

詳細: [BUG_FIX_PLAYBOOK.md #2](./BUG_FIX_PLAYBOOK.md)

---

## 4. データ管理の意図的判断

### 4.1 本番 DB は読み取り専用 (二重防御)

| レイヤ | 仕組み |
|---|---|
| Postgres ロール | `advisor_readonly` (SELECT 権限のみ、INSERT/UPDATE/DELETE/TRUNCATE 剥奪) |
| アプリ側 | `runReadOnly()` で `SET TRANSACTION READ ONLY` ラップ |
| ORM 分離 | `advisorDataPrisma` (本番 Supabase 用) と `prisma` (Advisor 自身のテーブル用) を別インスタンスに |
| ツール設計 | DB 書き込み系ツールを 1 つも作らない (Phase 1 の設計原則) |

#### 例外
**Advisor 自身のテーブル** (`AdvisorReportDraft` / `AdvisorReportVersion` 等) への書き込みは許容。
業務 DB ではなく Advisor 領域なので「副作用安全」の境界内。

### 4.2 保持期間ポリシー

| データ種別 | 保持期間 | 永続条件 | 削除トリガー |
|---|---|---|---|
| `AdvisorChatSession` 本体 | 永続 | (削除しない、知識ベース) | 手動アーカイブのみ |
| `AdvisorChatMessage` | セッションに従属 | 同上 | セッション削除時 cascade |
| `AdvisorReportDraft` | 30 日 | しおり付きセッションは永続 | cron (`bookmarked=false` + `updated_at < now-30d`) |
| `AdvisorReportVersion` | 30 日 | 同上 (親 Draft 連動) | 同上 |
| `AdvisorAuditLog` (一般) | 90 日 | — | cron (`created_at < now-90d`) |
| `AdvisorAuditLog` (`payload.kind = report_*`) | 180 日 | — | cron (`created_at < now-180d`) |
| 共有 URL | `shared_until` まで | 「+30 日延長」で更新 | cron が失効済みを null 化 |

実装: [app/api/cron/advisor-cleanup/route.ts](../src/app/api/cron/advisor-cleanup/route.ts)

#### 設計原則
**「ユーザーが能動的に保存判断したものだけ永続、それ以外は短期で消える」**

#### しおりの粒度
**AdvisorChatSession 単位** (= 配下の Draft / Versions 全部を保持)。
- 理由: ユーザーが「このチャットは大事」と判断する単位がセッション
- Version 単位ではしおり粒度が細かすぎて UX 上の負担が大きい

---

## 5. UI 設計の意図的判断

### 5.1 段階的ポーリング (停止条件は作らない)

| 条件 | 間隔 |
|---|---|
| アクティブ時 (`chatPhase !== 'idle'` / `chatLoading` / `generating` / `draft.status='generating'`) | 2 秒 |
| idle 時 | 8 秒 |

⚠️ **絶対遵守**: 「ポーリング停止」は **絶対やらない**。理由:
- 別タブでチャット送信した場合などに反映されない事故になる
- 最悪 8 秒で必ず最新化される設計

詳細: [ANTI_PATTERNS.md §2](./ANTI_PATTERNS.md)

### 5.2 状態専用ヘッダーで統一

drafting / updating / generating すべて Canvas のヘッダーで「⏳ ○○中... + 中止」表示で統一。
過去にあった「青い shimmer バナー」「警告バナー」「フッター primary ボタン」は全廃止。

理由: ノイズが減って読みやすい + 状態がヘッダー 1 行で分かる

### 5.3 disabled button の tooltip ラップ

`<button disabled title="...">` は Chrome で tooltip 表示されない。
全ての IconButton は **`<span title>` でラップ** + `aria-label` 併記。

実装: [src/components/advisor/report/report-canvas.tsx:1480-1492](../src/components/advisor/report/report-canvas.tsx)

### 5.4 楽観的 UI

Canvas 開いた瞬間に「ドラフト作成中... + 中止ボタン」を即時表示。
DB 取得待たずに UI を進める。

実装: 早期 return を 1 つに統合し `optimisticActive = chatPhase !== 'idle' || chatLoading` で判定

---

## 6. その他の意図的判断

### 6.1 自動モデル置換しない

過去に「Sonnet 4 が retire するから自動的に Sonnet 4.6 に置換する」コードを入れていたが、
**ユーザーが Sonnet 4 を明示指定しても 4.6 で実行される**性能比較の障害になったため撤去。

現在: retire 予定モデルは `console.warn` で警告ログのみ。判断はユーザーに委ねる。
強制置換が必要なら設定ページの `primary_model_id` を運用で書き換える方針。

実装: [src/lib/advisor/orchestrator.ts:235-257](../src/lib/advisor/orchestrator.ts)

### 6.2 in-memory 集計の OOM ガード (take=100k)

`query_metric` の日別集計 (`aggregateByDay`) は JS 側でメモリ展開してカウントしている。
本番 DB 規模が拡大すると OOM リスクがあるが、**Postgres 側集計に書き換えると JST 境界の取り扱いミスで数値ズレ事故になりうる** ため、保守的に `take: 100_000` 上限のみ追加。

超過時は `truncated: true` を data + metadata に流して LLM に「途中までの集計」と伝える。

実装: [src/lib/advisor/tools/tastas-data/query-metric.ts:387-415](../src/lib/advisor/tools/tastas-data/query-metric.ts)

### 6.3 checkCostCap

1 日のトークン上限ガード。デフォルト `2,000,000` トークン (`ADVISOR_DAILY_TOKEN_CAP` で上書き可)。
`app/api/advisor/chat/route.ts:143` で全リクエストの最初に呼ばれる。

実装: [src/lib/advisor/cost-guard.ts](../src/lib/advisor/cost-guard.ts)

---

## 7. 関連ドキュメント

- [ANTI_PATTERNS.md](./ANTI_PATTERNS.md) — 上記判断を「やってはいけない」形で再掲
- [BUG_FIX_PLAYBOOK.md](./BUG_FIX_PLAYBOOK.md) — 個別バグの修正エピソード
- [PROMPT_PATTERNS.md](./PROMPT_PATTERNS.md) — プロンプト設計の教訓
- [LATENCY_HISTORY.md](./LATENCY_HISTORY.md) — 速度改善の歴史
