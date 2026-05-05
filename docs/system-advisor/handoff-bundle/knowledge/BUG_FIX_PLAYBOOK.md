# BUG_FIX_PLAYBOOK — 過去のバグ → 修正のエピソード集

**作成**: 2026-05-04
**目的**: TASTAS Advisor 開発で **実際に踏んだバグ** を「症状 → 真因 → 修正」形式で記録。
hub-platform 側で同じパターンを再発させないため。

---

## エピソード一覧

| # | バグ | 重大度 | カテゴリ |
|---|---|---|---|
| 1 | Context Freeze バグ (asc + take で最古 N 件) | 🔴 P0 | persistence |
| 2 | LP 名取得バグ (LandingPage JOIN 不足) | 🟡 P1 | data / prompt |
| 3 | JST 境界処理の事故防止 | 🟡 P1 | data |
| 4 | ChatInput prefill 重複適用 | 🟡 P1 | UI / state |
| 5 | disabled button の tooltip 消失 | 🟢 P2 | UI / a11y |
| 6 | Markdown bullet が消える | 🟢 P2 | UI / CSS |
| 7 | ポーリング無限ループの恐れ | 🟡 P1 | UI / state |
| 8 | 「例として書いた架空指標」を Gemini が信じる | 🟡 P1 | prompt |
| 9 | 「迷ったら null で返す」の呼び戻し問題 | 🟡 P1 | prompt |
| 10 | データソース全展開漏れ | 🟡 P1 | data |
| 11 | 過去バージョン編集の継承漏れ | 🟡 P1 | data / prompt |
| 12 | Anthropic loop=1 TTFB 100 秒問題 | 🔴 P0 | LLM |
| 13 | get_report_draft ツールの往復問題 | 🟡 P1 | LLM |
| 14 | list_available_metrics の往復問題 | 🟡 P1 | LLM |
| 15 | 「Chat に送信」機能の混乱 | 🟢 P2 | UX |
| 16 | Stale Draft バナーの遺物 | 🟢 P2 | UX |
| 17 | レポート更新ボタンが大きすぎる | 🟢 P2 | UI |
| 18 | Auto モード自動置換の性能比較障害 | 🟡 P1 | model |

---

## #1: Context Freeze バグ (orderBy 'asc' + take で最古 N 件)

### 症状
長時間のチャットセッション (100 メッセージ超) で、ユーザーの新しい指示が LLM に無視される。
「さっき言ったでしょ?」が通用しない。記憶喪失。

### 真因
```typescript
// src/lib/advisor/persistence/messages.ts (バグ版)
const rows = await prisma.advisorChatMessage.findMany({
  where: { session_id: opts.sessionId, is_compacted: false },
  orderBy: { created_at: 'asc' },  // ← 古い順
  take: opts.limit ?? 100,           // ← 100 件に絞る
})
```
→ **「最古 100 件」**しか取得しない。100 件を超えた最新メッセージは LLM から不可視。

### 検出
2026-05-04 Antigravity 第 2 次ディープダイブ監査で発見 ([AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) #9)。

### 修正
```typescript
// 修正版
const rows = await prisma.advisorChatMessage.findMany({
  where: { session_id: opts.sessionId, is_compacted: false },
  orderBy: { created_at: 'desc' },  // ← 新しい順
  take: opts.limit ?? 100,
})
rows.reverse()  // メモリ上で時系列順に戻す
```

### 教訓
- `orderBy: 'asc' + take` は **「最古 N」**であって**「最新 N」ではない**
- 「最新 N を時系列順で」が欲しい場合は **必ず desc + take + reverse()**

### 関連
- [ANTI_PATTERNS.md §15](./ANTI_PATTERNS.md)
- 実コード: `src/lib/advisor/persistence/messages.ts`

---

## #2: LP 名取得バグ (LandingPage JOIN 不足)

### 症状
- LLM がドラフト段階で「LP 5 (キラキラ介護転職 LP)」のような体裁を約束する
- 最終レポートを見ると「LP 5」だけで LP 名が消えている
- ユーザーから「ID だけで意味が分からない」と指摘
- ユーザーが LLM に「LP 名で表示して」と再指示しても LLM は「取ったつもり」と返す (実際は取れていない)

### 真因
`query_metric` の `groupBy: 'lp_id'` 戻り値が `key = lp_id (数字 ID)` のみで、LP 名 (LandingPage.name) が一切含まれていなかった。

```typescript
// バグ版: name を取得していない
return {
  rows: grouped.map((g) => ({
    key: g.lp_id ?? '(null)',
    value: g._count._all,
  })),
  // ↑ name は無い
}
```

LLM は skeleton で「LP 名表示します」と約束するが、データ側に名前が無いのでフェイク表現になる。

### 検出
2026-05-04 ユーザー指摘 (チャットログから判明)。

### 修正

1. **`query_metric` の戻り値型を拡張** ([query-metric.ts](../src/lib/advisor/tools/tastas-data/query-metric.ts)):
```typescript
interface Output {
  rows: Array<{ key: string; value: number; label?: string }>;  // label 追加
}
```

2. **LandingPage 一括 JOIN ヘルパー** を新設:
```typescript
async function resolveLpLabels(tx, lpIds: string[]): Promise<Map<string, string>> {
  const lpNumbers = lpIds.map(s => parseInt(s, 10)).filter(Number.isFinite)
  const pages = await tx.landingPage.findMany({
    where: { lp_number: { in: lpNumbers } },
    select: { lp_number: true, name: true },
  })
  const labels = new Map<string, string>()
  for (const p of pages) {
    labels.set(String(p.lp_number), `LP ${p.lp_number} (${p.name})`)
  }
  return labels
}
```

3. **LP_PV / LP_REGISTRATIONS / LP_TO_LINE_CONV の `groupBy: 'lp_id'` 分岐すべて** で label を埋める:
```typescript
const lpIds = grouped.map(g => g.lp_id).filter((v): v is string => !!v)
const labels = await resolveLpLabels(tx, lpIds)
return {
  rows: grouped.map(g => ({
    key: g.lp_id ?? '(null)',
    label: labels.get(g.lp_id ?? ''),  // ← LP 名
    value: g._count._all,
  })),
}
```

4. **Gemini プロンプト**で「label を優先表示」を明示:
- `generate.ts`: 「LP 表示の必須ルール — 必ず label を表示」セクション追加
- `gemini-draft-create.ts` / `gemini-edit.ts`: 「skeleton 段階で具体的な LP 名 / キャンペーン名 / 求人名を書かない」ルール追加 + 表の例を `LP 5 (◯◯キャンペーン LP)` 形式 + プレースホルダ "-" に変更

### 教訓
- LLM が「あるはず」と信じてしまうデータは、**ツール側で必ず提供する**
- LLM プロンプトに「ある」と書くだけでは出ない、**実データで保証**する
- skeleton 段階では正式名称が分からないので**プレースホルダだけにする**

### 関連
- [ANTI_PATTERNS.md §3](./ANTI_PATTERNS.md)
- 実コード: `src/lib/advisor/tools/tastas-data/query-metric.ts` `resolveLpLabels`

---

## #3: JST 境界処理の事故防止

### 症状 (発生したわけではないが、未然に防いだ事例)
`aggregateByDay` の SQL 化を検討した時、`DATE_TRUNC('day', created_at)` を UTC で打つと UTC 境界で集計され、JST 基準の数値と最大 9 時間ズレる。

### 経緯
2026-05-04 に「query_metric の in-memory 集計が将来 OOM するから SQL 化したい」と Antigravity が提案。
SQL 書き換え案を一度検討したが、「**JST 境界処理の事故リスク > パフォーマンス改善効果**」と判断して保守案 (take=100k 上限のみ) に変更。

### 採用判断
- in-memory 集計は維持 (JST 変換ロジック完全保持)
- `take: 100_000` 上限で OOM 防止
- 超過時は `truncated: true` を data + metadata に流して LLM に明示

### もし将来 SQL 化するなら
```sql
-- ✅ 正しい (JST 境界)
SELECT (created_at AT TIME ZONE 'Asia/Tokyo')::date AS day, COUNT(*)
FROM lp_page_views
WHERE created_at BETWEEN $1 AND $2
GROUP BY day;
```

書き換え前に**集計値の完全一致**を検証必須。

### 教訓
- パフォーマンス改善 vs 数値ズレリスクのトレードオフでは **数値正確性を優先**
- 「分析の数字が変わる」事故はユーザー信頼を失う

### 関連
- [ANTI_PATTERNS.md §4](./ANTI_PATTERNS.md)
- 実コード: `src/lib/advisor/tools/tastas-data/query-metric.ts` `aggregateByDay`

---

## #4: ChatInput prefill 重複適用

### 症状
suggestion チップ「ログを集計してレポート生成」をクリックして prefill されたテキストが、
別のセッションに切り替えると同じテキストが再表示される。

### 真因
ChatInput は `key={conversationId}` で再マウントされる。
prefill state が残ったまま再マウントすると `useEffect([prefill])` が発火して同じテキストが再入力される。

### 修正
**送信時に必ず `setChatPrefill(null)` でクリア**:
```typescript
const handleSubmit = async () => {
  await sendMessage(input)
  setChatPrefill(null)  // ← 必須
}
```

### 教訓
- React の `key` 変更は再マウントを引き起こす
- 親 state を持っていると再マウント時に副作用が再実行される
- prefill 系は **使い捨て** にする (送信したら即クリア)

### 関連
- [ANTI_PATTERNS.md §12](./ANTI_PATTERNS.md)
- 実コード: `src/components/advisor/chat/chat-layout.tsx`

---

## #5: disabled button の tooltip 消失

### 症状
ボタンが disabled (グレー) になっている時、なぜ押せないのかユーザーが分からない。
`<button disabled title="○○のため押せません">` を書いても Chrome で tooltip が表示されない。

### 真因
HTML 仕様: `<button disabled>` は pointer events を受けないため、`title` 属性の tooltip が出ない。

### 修正
**`<span title>` でラップ**:
```tsx
<span title="○○のため押せません" className="inline-flex">
  <button disabled aria-label="○○のため押せません">
    <Icon />
  </button>
</span>
```

### 教訓
- アクセシビリティと UX のために `aria-label` も併記
- `IconButton` 共通コンポーネントに集約 ([report-canvas.tsx:1457-1493](../src/components/advisor/report/report-canvas.tsx))

### 関連
- [ANTI_PATTERNS.md §14](./ANTI_PATTERNS.md)

---

## #6: Markdown bullet が消える

### 症状
ReactMarkdown でレンダリングした箇条書きが点 (bullet) なしで表示される。

### 真因
- TASTAS は Tailwind の preflight (`@tailwind base`) が `<ul>` `<ol>` のリストスタイルをリセット
- `@tailwindcss/typography` (`prose` クラス) も未導入

### 修正
ReactMarkdown の `components` prop で `ul/ol/li` を明示スタイル化:
```tsx
const MARKDOWN_COMPONENTS = {
  ul: ({ children, ...props }) => (
    <ul {...props} className="list-disc list-outside pl-5 my-2 space-y-1 marker:text-slate-400">
      {children}
    </ul>
  ),
  // ol, li も同様
}
```

### 影響範囲
- `report-canvas.tsx` (Canvas)
- `unified-message.tsx` (チャット)
- `report-detail.tsx` (履歴詳細)
- 公開シェアページ

### 教訓
- 共通の Markdown レンダリング設定を 1 ヶ所に集約すべき (現在は各ファイルに分散している、リファクタ余地)

### 関連
- [ANTI_PATTERNS.md §13](./ANTI_PATTERNS.md)

---

## #7: ポーリング無限ループの恐れ

### 症状 (未然に防いだ事例)
Antigravity 監査が「Canvas のポーリング (setInterval 2s) は SSE と競合してバグの温床」と指摘。
SSE 化への大規模リファクタを検討した。

### 採用判断
- SSE 化は本格対応として保留
- 短期改善として **段階的ポーリング** (アクティブ時 2s / idle 時 8s) を導入
- **「停止」は絶対やらない**設計

### 理由
ポーリング停止条件を作ると、ユーザーが別タブでチャット送信した場合などに反映されない事故になる。
最悪 8 秒で必ず最新化される設計を維持。

### 教訓
- 軽量化のためのバグを入れるリスクは効果を上回る
- 「停止する条件」より「常に回す + 間隔だけ伸ばす」が安全

### 関連
- [ANTI_PATTERNS.md §2](./ANTI_PATTERNS.md)
- 実コード: `src/components/advisor/report/report-canvas.tsx` ポーリング useEffect

---

## #8: 「例として書いた架空指標」を Gemini が信じる

### 症状
「(例: ["LP_PV", "LP_TO_LINE_CONV"])」とプロンプト・schema コメント・型定義の複数箇所に書かれていた。
当時 `LP_TO_LINE_CONV` は未実装だったが、Gemini が実在指標と誤認 → query_metric が「不明な metric_key」で弾く → 表が空に。

### 真因
プロンプトの「例」をユーザー (LLM) は **実在する** と解釈する。

### 修正
- プロンプト・schema コメント・型定義の **「例」** には**実在するキーだけ**使う
- 命名がもっともらしいダミーは絶対に書かない

(その後 `LP_TO_LINE_CONV` は実装されたので現在は実在指標になっている)

### 教訓
- LLM 向け「例」は **存在保証** が必要
- ダミー名は **絶対に避ける**

### 関連
- [PROMPT_PATTERNS.md §1](./PROMPT_PATTERNS.md)
- [ANTI_PATTERNS.md §8](./ANTI_PATTERNS.md)

---

## #9: 「迷ったら null で返す」の呼び戻し問題

### 症状
revise (draft_revise) で skeleton に流入経路の表を追加したのに dataSources に query_ga4 が追加されず、レポート生成で空表になる。

### 真因
Gemini は「変更ないかも」と迷うと null (= 変更なし) を返しがち。
既存プロンプトが「変更があれば更新、なければ null」と書いていたため、迷った場合は null (省略) になっていた。

### 修正
プロンプトで以下を明示:
- **「迷ったら更新する側に倒す」**
- **「null を返してよいのは文言修正のみのとき」**

### 教訓
- LLM の「迷い」のデフォルト挙動を意図的に制御する
- プロンプトで「不確実な時はこう振る舞え」を明示

### 関連
- [PROMPT_PATTERNS.md §2](./PROMPT_PATTERNS.md)
- [ANTI_PATTERNS.md §10](./ANTI_PATTERNS.md)

---

## #10: データソース全展開漏れ

### 症状
レポート生成時に GA4 の流入経路 / ページ別 PV のデータが Gemini に渡らず、本文で「データがない」と書かれる。

### 真因
`query_ga4` を `report_type: 'overview'` の 1 種類だけで呼んでいた。

### 修正
ツール側に enum (reportType / dimensions / source / level / env など) がある場合、レポート用 collect ではデフォルトで全展開する:
- `query_metric`: metric × supportedGroupBy 全展開
- `query_ga4`: 5 種 (overview / traffic / pages / lpPerformance / comparison)
- `query_search_console`: 4 種 ([query] / [page] / [device] / [country])
- `get_supabase_logs`: 3 種 (postgres / api / auth)
- `get_vercel_logs`: 3 種 (error / warning / info)
- `get_vercel_deployments`: 2 種 (production / preview)

### 副作用と根拠
- `Promise.all` 並列実行なので所要時間は最遅リクエストで律速 = 体感速度変わらず
- リクエスト数は増えるが API クォータの範囲内

### 教訓
- ツールの能力をフル活用する設計に
- 並列実行で所要時間を律速点に

### 関連
- [DATA_COLLECTION_PATTERNS.md §1](./DATA_COLLECTION_PATTERNS.md)
- 実コード: `src/lib/advisor/reports/collect.ts`

---

## #11: 過去バージョン編集の継承漏れ

### 症状
ユーザーが result v3 で「日付フォーマットを MM/DD に」修正 → auto-redraft で再生成すると元に戻る。

### 真因
`generate.ts` が skeleton + collected_data から完全新規生成していた (前バージョンを見ていない)。

### 修正
`previousResultMarkdown` を Gemini に渡し、システムプロンプトに「**最重要ルール 1: 前回バージョンの編集スタイルを絶対維持**」追加。

### 教訓
- ユーザーが手作業修正したものを再生成で破壊しない
- 過去版を毎回コンテキストに含めて継承

### 関連
- [DATA_COLLECTION_PATTERNS.md §2](./DATA_COLLECTION_PATTERNS.md)
- 実コード: `src/lib/advisor/reports/generate.ts`

---

## #12: Anthropic loop=1 TTFB 100 秒問題

### 症状
ツール実行後の最終応答 (loop=1) で TTFB が 90〜130 秒になる事象が頻発。
ユーザーが 2 分待たされる。

### 真因 (2026-05-03 ジッター分析より)
- 遅い 7 件すべてが loop=1
- cacheRead 中央値 60,898 tokens (キャッシュは効いている)
- cacheCreate 中央値 493 tokens (完全な再書き込みではない)
- → **Anthropic 側のロードバランサーがキャッシュ KV を持つノードと別ノードにルーティング** し、リハイドレーション (中央ストアから VRAM への物理転送) で 90-130 秒待たされている
- → こちら側では制御不能

### 修正
重い処理を **Gemini 2.5 Flash 直叩きでバイパス** する設計に転換。

### Phase 別改善履歴
| Phase | 対応 | TTFB |
|---|---|---|
| 初期 | Anthropic loop=1 で update_report_draft → 複数 round trip | 100 秒級 |
| Phase A | `[TOOL:draft_revise]` を Gemini 直叩き | 4-10 秒 |
| Phase B | `[TOOL:report_create]` も Gemini 直叩き | 9 秒前後 |
| Phase C | `[TOOL:result_edit]` 経路新設 | 5-10 秒 |
| Phase D | auto-redraft 自動化 | 40 秒前後 |

### 教訓
- LLM API のサーバー側問題は工夫の限界がある
- 重い処理は別 LLM (より速いもの) にバイパスする方が筋が良い
- Anthropic にこだわらず、Gemini / OpenAI / 自社モデル等を**用途別に使い分ける**

### 関連
- [DESIGN_DECISIONS.md §1.1](./DESIGN_DECISIONS.md)
- [LATENCY_HISTORY.md](./LATENCY_HISTORY.md)

---

## #13: get_report_draft ツールの往復問題

### 症状
LLM が draft_revise を受けて update_report_draft する前に、現状ドラフトを取得するため `get_report_draft` を呼ぶ → ツール往復で loop=1 が発生 → Anthropic TTFB 100 秒問題に直撃。

### 修正
`get_report_draft` ツール **廃止**。代わりに dynamic system prompt に「現在のレポートドラフト状態」を毎回埋め込む。

LLM は最初から context にドラフト全体を持っているので、往復不要。

### 教訓
- ツール往復は loop を増やす = TTFB を悪化させる
- 静的に近いデータは context に直接埋め込む
- prompt cache (5 分 ephemeral) で再送コストは抑えられる

### 関連
- [DESIGN_DECISIONS.md §2.2](./DESIGN_DECISIONS.md)
- 実コード: `src/lib/advisor/system-prompt.ts` dynamicPart

---

## #14: list_available_metrics の往復問題

### 症状
LLM が `query_metric` を呼ぶ前に「どんな指標があるか」を `list_available_metrics` で取得 → 2 段階のツール呼び出し。

### 修正
`list_available_metrics` ツール **廃止**。代わりに METRIC_CATALOG を system prompt の cachedPart に Markdown 表として静的埋め込み。

### 教訓
- 静的データは system prompt にキャッシュさせる方が安い (cacheRead で済む)
- ツール呼び出しは「動的に変わるもの」だけに限定

### 関連
- [DESIGN_DECISIONS.md §2.1](./DESIGN_DECISIONS.md)
- 実コード: `src/lib/advisor/system-prompt.ts` `buildMetricsCatalogSection`

---

## #15: 「Chat に送信」機能の混乱

### 症状
かつて Canvas に「📤 Chat に送信」ボタンがあり、生成したレポートを Google Chat スペースに送信できた。
が、ユーザーから「使わない」「ボタンが多くて UI ノイズ」との指摘で 2026-05-04 撤去。

### 修正
- ボタン削除
- `/api/advisor/report/notify-gchat` 削除
- `src/lib/advisor/reports/notify-google-chat.ts` 削除
- `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` 環境変数も廃止対象 (env-vars.md から削除)

### 教訓
- 使われない機能は早く削除する
- UI ノイズの方がコストになる

---

## #16: Stale Draft バナーの遺物

### 症状
レポート結果ビューで「レポート生成後にドラフトが更新されています。最新の内容を反映するには『レポート更新』を実行してください」という amber バナーが表示されていた。

### 真因
過去仕様 (auto-redraft 未実装) の遺物。
現在は auto-redraft + 「レポート更新」アイコンが自動的に新バージョンを作るので、ユーザーに手動更新を促すバナーは不要。

### 修正
2026-05-04 削除。stale の気付きはタブ脇の amber ドット表示で代替 (既存実装、維持)。

### 教訓
- 機能追加で不要になった UI を残しっぱなしにしない
- バナー / アラート系は特に「いつ消すか」設計時に決める

### 関連
- 実コード: `src/components/advisor/report/report-canvas.tsx` (バナー削除済み)

---

## #17: レポート更新ボタンが大きすぎる

### 症状
Canvas ヘッダーの「🔄 レポート更新」が **テキスト付き primary ボタン** (黒背景・白文字) で、編集 / 共有のアイコンボタンと並ぶと大きすぎてバランスが悪い。

### 修正
2026-05-04 IconButton (アイコンのみ + マウスオーバー説明) に統一。

### 教訓
- ヘッダーアクションは アイコンのみ + tooltip で揃える
- primary ボタン (テキスト付き) は本当の主アクション 1 個だけに留める

---

## #18: Auto モード自動置換の性能比較障害

### 症状
過去に「retire 予定モデル (claude-sonnet-4-20250514) は自動的に sonnet-4-6 に置換」コードを入れていた。
ユーザーが「Sonnet 4 で性能比較したい」と明示指定したのに 4.6 で実行されて、計測結果が信用できなかった。

### 修正
自動置換コード撤去。`console.warn` で警告ログのみ。判断はユーザーに委ねる。
強制置換が必要なら設定ページの `primary_model_id` を運用で書き換える方針。

### 教訓
- ユーザーの明示指定を勝手に上書きしない
- 「自動的に良くする」は性能比較や検証の障害になりうる

### 関連
- [ANTI_PATTERNS.md §5](./ANTI_PATTERNS.md)
- 実コード: `src/lib/advisor/orchestrator.ts:235-257`

---

## 関連ドキュメント

- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) — なぜこの設計か
- [ANTI_PATTERNS.md](./ANTI_PATTERNS.md) — やってはいけないこと
- [PROMPT_PATTERNS.md](./PROMPT_PATTERNS.md) — プロンプト設計の教訓
- [LATENCY_HISTORY.md](./LATENCY_HISTORY.md) — 速度改善の歴史
- [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) — Antigravity 監査結果
