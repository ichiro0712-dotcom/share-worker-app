# ANTI_PATTERNS — やってはいけないこと

**作成**: 2026-05-04
**目的**: TASTAS Advisor で **過去に踏んだ罠** を「絶対やってはいけないこと」として明文化。
hub-platform 側で advisor-core を抽出するときに **同じ失敗を繰り返さない** ため。

⚠️ 本ファイルに書かれた anti-pattern は **理由を理解せずに「改善」しないこと**。
やる場合は本ファイルを更新して **新しい判断理由** を残すこと。

---

## 1. ❌ Anthropic フォールバックを復活させない

**やりたくなる理由**: 堅牢性のため、Gemini 失敗時に Anthropic に流したくなる

**なぜダメか**:
- Anthropic loop=1 TTFB 100 秒問題に直撃
- ユーザーが 2 分待たされて結局答えが返らない最悪 UX
- **5-10 秒で「失敗、再試行を」を返す方が遥かに良い**

**正しい挙動**: Gemini バイパス失敗 → 即時 `error` イベント
```typescript
// ❌ やってはいけない
try {
  await callGemini()
} catch {
  await callAnthropic()  // 100 秒待たされる
}

// ✅ 正しい
try {
  await callGemini()
} catch (e) {
  return { error: 'レポート生成に失敗しました。再試行してください' }
}
```

**例外**: 前提条件 NG (no draft / admin mismatch) のみ Anthropic に流す。
これらは Gemini を呼ぶ意味がないケース。

**実コード**: [src/lib/advisor/orchestrator.ts](../src/lib/advisor/orchestrator.ts)
**詳細**: [DESIGN_DECISIONS.md §1.2](./DESIGN_DECISIONS.md)

---

## 2. ❌ ポーリング停止条件を作らない

**やりたくなる理由**:
- 「draft.status='completed' になったら止めれば省コスト」
- 「Canvas を見ていない時は止める」
- 「アイドル N 分後に止める」

**なぜダメか**:
- ユーザーが別タブでチャット送信した場合に反映されない
- 「Claude が更新したのに Canvas に反映されない」事故になる
- 過去にこの種のバグで「ドラフト更新が見えない」ユーザー報告あり

**正しい挙動**: **段階的ポーリング (停止しない)**
```typescript
// ❌ やってはいけない
if (draft.status === 'completed' && view === 'result') {
  clearInterval(pollRef.current)  // 止めない!
}

// ✅ 正しい
const isActive = chatPhase !== 'idle' || chatLoading || generating || draft?.status === 'generating'
const intervalMs = isActive ? 2000 : 8000
pollRef.current = window.setInterval(reload, intervalMs)
```

**実コード**: [src/components/advisor/report/report-canvas.tsx](../src/components/advisor/report/report-canvas.tsx) `useEffect([reload, chatPhase, chatLoading, generating, draft?.status])`
**詳細**: [DESIGN_DECISIONS.md §5.1](./DESIGN_DECISIONS.md)

---

## 3. ❌ skeleton で具体的な LP 名 / キャンペーン名 / 求人名を書かない

**やりたくなる理由**: skeleton をリアルに見せたい

**なぜダメか**:
- skeleton 段階では LandingPage / 求人 / キャンペーンの正式名称が分からない (まだ DB 取得していない)
- 結果: 「LP 5 (キラキラ介護転職 LP)」と書いた skeleton から本文生成すると、`query_metric` の戻り値に LP 名が入っていない場合に「LP 5」だけになる
- ユーザーから「ID だけで意味分からない」と過去に指摘あり

**正しい挙動**:
```markdown
❌ やってはいけない (skeleton):
| 順位 | LP | PV |
|---|---|---|
| 1  | LP 5 (キラキラ介護転職 LP) | 0 |  ← 固有名禁止

✅ 正しい (skeleton):
| 順位 | LP | PV |
|---|---|---|
| 1  | - | 0 |  ← プレースホルダ "-"

(本文生成時に query_metric の rows[].label から
 「LP 5 (実際の LP 名)」が埋まる)
```

**実装**:
- `query_metric` の戻り値に `label?: string` を追加 ([query-metric.ts](../src/lib/advisor/tools/tastas-data/query-metric.ts))
- `resolveLpLabels(tx, lpIds)` ヘルパーで LandingPage を一括 JOIN
- Gemini プロンプト ([generate.ts](../src/lib/advisor/reports/generate.ts) / [gemini-draft-create.ts](../src/lib/advisor/llm/gemini-draft-create.ts) / [gemini-edit.ts](../src/lib/advisor/llm/gemini-edit.ts)) で「label 優先表示」「skeleton で固有名禁止」を明示

**詳細**: [BUG_FIX_PLAYBOOK.md #2](./BUG_FIX_PLAYBOOK.md)

---

## 4. ❌ Postgres 集計を SQL で雑に書き換えない (JST 境界)

**やりたくなる理由**: `aggregateByDay` の in-memory 集計が遅い / OOM リスク

**なぜダメか**:
- 既存実装は **JST 境界で日付グループ化** している
- SQL に書き換える時、`DATE_TRUNC('day', created_at)` を UTC で打つと UTC 境界になり**集計値が変わる**
- 「分析の数字が変わる」事故になる (本番運用で数字を見ているユーザーが困る)

**現状の保守的対策** (2026-05-04 採用):
- `take: 100_000` 上限のみ追加 (OOM 防止)
- 超過時は `truncated: true` を data + metadata に流す
- JST 変換ロジックは完全保持 (`dt + 9h offset` → `toISOString().slice(0,10)`)

**もし将来 SQL 化するなら**:
```sql
-- ✅ 正しい (JST 境界で日付グループ化)
SELECT (created_at AT TIME ZONE 'Asia/Tokyo')::date AS day, COUNT(*) AS value
FROM lp_page_views
WHERE created_at >= $1 AND created_at <= $2
GROUP BY day
ORDER BY day;

-- ❌ やってはいけない (UTC 境界になる)
SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)
FROM lp_page_views
GROUP BY day;
```

**書き換える前に**:
1. 既存実装の集計値を検証用に複数日分 JSON 保存
2. SQL 版で集計
3. **値が完全一致**することを確認してから差し替え

**実コード**: [src/lib/advisor/tools/tastas-data/query-metric.ts](../src/lib/advisor/tools/tastas-data/query-metric.ts) `aggregateByDay`
**詳細**: [DESIGN_DECISIONS.md §6.2](./DESIGN_DECISIONS.md)

---

## 5. ❌ retire 予定モデルを自動置換しない

**やりたくなる理由**: claude-sonnet-4-20250514 が 2026-06-15 で retire するので、自動的に sonnet-4-6 に置き換えれば事故防げる

**なぜダメか**:
- ユーザーが「Sonnet 4 で性能比較したい」と明示指定しているのに 4.6 で実行されて、計測結果が信用できない
- 過去にこの種の自動置換でユーザーから苦情

**正しい挙動**: 警告ログ (`console.warn`) のみ、判断はユーザーに委ねる
```typescript
// ❌ やってはいけない
if (model === 'claude-sonnet-4-20250514') {
  model = 'claude-sonnet-4-6'  // 黙って置き換える
}

// ✅ 正しい
if (RETIRING_MODELS.has(model)) {
  console.warn(`[advisor] model "${model}" is retiring 2026-06-15. Consider migrating.`)
}
// model はそのまま使う
```

**強制置換が必要なら**: 設定ページ (`AdvisorSettings.primary_model_id`) を運用で書き換える方針。

**実コード**: [src/lib/advisor/orchestrator.ts:235-257](../src/lib/advisor/orchestrator.ts)
**詳細**: [DESIGN_DECISIONS.md §6.1](./DESIGN_DECISIONS.md)

---

## 6. ❌ Vercel 環境変数 / 本番 DB を Claude Code が直接操作しない

**やりたくなる理由**: 自動化したい

**なぜダメか**:
- TASTAS の CLAUDE.md に **明示的に禁止** されている
- Vercel env を CLI で操作 (`vercel env add/rm/pull`) すると本番に直接影響
- `npx prisma db push` を本番 DATABASE_URL で実行すると本番スキーマが変わる
- 過去に誤って main にマージしてしまったインシデントあり

**正しい挙動**:
- Claude Code は「変更が必要です」と**ユーザーに報告**するだけ
- ユーザーが Vercel ダッシュボード / SQL Editor で**手動操作**

**報告テンプレ**:
```
【Vercel 環境変数の変更が必要です】
- 操作: 追加 / 変更 / 削除
- 変数名: GEMINI_API_KEY
- 値: AIza... (Google AI Studio で発行)
- 対象環境: Production / Preview / All Environments
- ⚠️ Vercel ダッシュボードから手動で操作してください
- ⚠️ 変更後は Redeploy が必要です
```

**実コード**: 該当なし (Claude Code が**やらない**ことが正解)
**根拠**: TASTAS リポジトリの [CLAUDE.md](../../../CLAUDE.md) (Vercel env / DB 操作の禁止事項)

---

## 7. ❌ git push --force / gh pr merge を Claude Code が実行しない

**やりたくなる理由**: 自動化したい

**なぜダメか**:
- TASTAS の CLAUDE.md に **明示的に禁止**
- 過去に Claude Code が誤って main にマージしてしまったインシデントあり

**正しい挙動**:
- PR 作成までが Claude Code の役割 (`gh pr create --base develop`)
- マージはユーザー手動
- マージ実行を明示的に指示された場合のみ可、その時もマージ先を必ず確認

---

## 8. ❌ プロンプトに架空の指標 / カラム / API 名を書かない

**やりたくなる理由**: 例として書きたい

**なぜダメか**:
- LLM が「実在する」と信じて使ってしまう
- 過去事故: プロンプトに `LP_TO_LINE_CONV` を例として書いた → Gemini が実在指標と誤認 → query_metric が「不明な metric_key」で弾く → 表が空に
- 結果: ユーザーから「データ取れていない」と指摘

**正しい挙動**:
- プロンプト・schema コメント・型定義の **「例」** には**実在するキーだけ**使う
- 命名がもっともらしいダミーは**絶対に書かない** (`LP_TO_LINE_CONV` のような未実装が紛れる温床)

**実例**: 上記 `LP_TO_LINE_CONV` は事故後に実装されたので現在は実在指標になっている。

**詳細**: [PROMPT_PATTERNS.md §1](./PROMPT_PATTERNS.md), [BUG_FIX_PLAYBOOK.md #8](./BUG_FIX_PLAYBOOK.md)

---

## 9. ❌ ヘッダー型・章構成を固定しない

**やりたくなる理由**: 「サマリ → 主要数値 → 次のアクション」の固定型を強制すれば構造が安定

**なぜダメか**:
- レポートは「主要 KPI 集計」「輪切り分析」「ad hoc 調査」「障害振り返り」など多様な用途で使う
- 固定型を強制すると柔軟性を損なう
- ユーザーが Canvas で作った skeleton をそのまま忠実に踏襲する原則

**正しい挙動**: skeleton をそのまま踏襲、実数字を埋める

**詳細**: [DESIGN_DECISIONS.md §3.3](./DESIGN_DECISIONS.md)

---

## 10. ❌ プロンプトを「変更ないなら null」で許す

**やりたくなる理由**: 不要な更新を減らせる

**なぜダメか**:
- Gemini は「変更ないかも」と迷うと null (= 変更なし) を返しがち
- 結果: revise で skeleton に表を追加したのに dataSources が更新されず、本文生成で空表になる事故あり

**正しい挙動**: プロンプトで以下を明示
- **「迷ったら更新する側に倒す」**
- **「null を返してよいのは文言修正のみのとき」**

**実コード**: [src/lib/advisor/llm/gemini-edit.ts](../src/lib/advisor/llm/gemini-edit.ts) のシステムプロンプト
**詳細**: [PROMPT_PATTERNS.md §2](./PROMPT_PATTERNS.md), [DESIGN_DECISIONS.md §3.1](./DESIGN_DECISIONS.md)

---

## 11. ❌ 監査レポートを検証なしで信じない

**やりたくなる理由**: AI 監査ツールが「クリティカルバグ発見」と言ったら焦って修正したくなる

**なぜダメか**:
- 過去 Antigravity 監査で「クリティカル 3 件発見」のうち 2 件は**実コードを読まずに憶測で書いた誤指摘**だった
- 例: 「checkCostCap が Dead Code」→ 実は `chat/route.ts:143` で呼ばれている
- 例: 「audit log で巨大 JSON が二重保存」→ 実は audit は metadata のみ
- 既存の意図的な設計判断 (例: Anthropic フォールバック撤去) を見落として「未実装」と指摘されることも

**正しい挙動**:
1. 監査レポートを取り込んだら、**実コードを読んで指摘の真偽を 1 件ずつ検証**
2. 既存の意図的判断 (本ファイル + DESIGN_DECISIONS.md) と整合するか確認
3. 真のバグだけ修正、誤指摘は監査レポートに訂正注記を追記

**詳細**: [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) の検証マトリクス

---

## 12. ❌ ChatInput の prefill をクリアしない

**やりたくなる理由**: ない (クリア忘れがバグになる)

**なぜダメか**:
- ChatInput は `key={conversationId}` で再マウントされる
- prefill state が残ったまま再マウントすると、再度 `useEffect([prefill])` が発火して同じテキストが再入力される

**正しい挙動**: 送信時に必ず `setChatPrefill(null)` でクリア
```typescript
// ❌ やってはいけない
const handleSubmit = async () => {
  await sendMessage(input)
  // chatPrefill をクリア忘れ → 再マウント時に再適用
}

// ✅ 正しい
const handleSubmit = async () => {
  await sendMessage(input)
  setChatPrefill(null)  // 必須
}
```

**実コード**: [src/components/advisor/chat/chat-layout.tsx](../src/components/advisor/chat/chat-layout.tsx)
**詳細**: [BUG_FIX_PLAYBOOK.md #4](./BUG_FIX_PLAYBOOK.md)

---

## 13. ❌ Markdown bullet を Tailwind preflight に任せない

**やりたくなる理由**: `<ul>` だけで bullet 出ると思いがち

**なぜダメか**:
- TASTAS は Tailwind の preflight が `<ul>` `<ol>` のリストスタイルをリセット
- `@tailwindcss/typography` (prose) も未導入
- → デフォルトで bullet が消える

**正しい挙動**: ReactMarkdown の `components` prop で `ul/ol/li` を明示スタイル化

```tsx
const MARKDOWN_COMPONENTS = {
  ul: ({ children, ...props }) => (
    <ul {...props} className="list-disc list-outside pl-5 my-2 space-y-1 marker:text-slate-400">
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol {...props} className="list-decimal list-outside pl-5 my-2 space-y-1 marker:text-slate-400">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li {...props} className="leading-relaxed">{children}</li>
  ),
}
```

**実コード**: [src/components/advisor/report/report-canvas.tsx](../src/components/advisor/report/report-canvas.tsx) `MARKDOWN_COMPONENTS`
**影響**: report-canvas / unified-message / report-detail / 公開シェアページの全 ReactMarkdown 呼び出し

---

## 14. ❌ disabled `<button title="...">` で済ませない

**やりたくなる理由**: 「title 属性で tooltip 出るでしょ」

**なぜダメか**:
- Chrome では `<button disabled title="...">` の tooltip が**表示されない**
- ユーザーが「なぜ押せないか分からない」状態になる

**正しい挙動**: `<span title>` でラップ + `aria-label` 併記
```tsx
// ❌ やってはいけない
<button disabled title="○○のため押せません">
  <Icon />
</button>

// ✅ 正しい
<span title="○○のため押せません" className="inline-flex">
  <button disabled aria-label="○○のため押せません">
    <Icon />
  </button>
</span>
```

**実コード**: [src/components/advisor/report/report-canvas.tsx:1480-1492](../src/components/advisor/report/report-canvas.tsx) `IconButton`
**影響**: 全 IconButton 利用箇所

---

## 15. ❌ orderBy: 'asc' + take で「最新 N 件」のつもりにならない

**やりたくなる理由**: 古い順に並べたい時に asc を使いがち

**なぜダメか**:
- `orderBy: 'asc' + take: 100` は「**最古** 100 件」を取る
- 100 件超のセッションでは新しい指示が LLM に渡らない
- 過去 Antigravity 監査で発見された Context Freeze バグの真因

**正しい挙動**: `orderBy: 'desc' + take: N + reverse()`
```typescript
// ❌ やってはいけない (最古 100 件しか取らない)
const rows = await prisma.advisorChatMessage.findMany({
  orderBy: { created_at: 'asc' },
  take: 100,
})

// ✅ 正しい (最新 100 件を時系列順で返す)
const rows = await prisma.advisorChatMessage.findMany({
  orderBy: { created_at: 'desc' },
  take: 100,
})
rows.reverse()
```

**実コード**: [src/lib/advisor/persistence/messages.ts:54-76](../src/lib/advisor/persistence/messages.ts) `getRecentMessagesForOrchestrator`
**詳細**: [BUG_FIX_PLAYBOOK.md #1](./BUG_FIX_PLAYBOOK.md), [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) #9

---

## 16. ❌ JST と UTC を混ぜない

**やりたくなる理由**: `new Date()` を「今日」判定に使いがち

**なぜダメか**:
- TASTAS は日本国内向けで JST 基準
- Vercel サーバーは UTC で動作 → `new Date()` は UTC タイムスタンプ
- 「今日」判定で最大 9 時間のズレが発生

**正しい挙動**: JST ヘルパーを使う
```typescript
// ❌ やってはいけない
const today = new Date()
if (record.date < today) { ... }

// ✅ 正しい
import { getTodayJSTStart, toJSTDateString } from './jst'
const todayStr = toJSTDateString(getTodayJSTStart())
const recordStr = toJSTDateString(record.date)
if (recordStr < todayStr) { ... }
```

**実コード**: [src/lib/advisor/jst.ts](../src/lib/advisor/jst.ts) (ヘルパー)
**根拠**: TASTAS リポジトリの [CLAUDE.md](../../../CLAUDE.md) JST ルール

---

## 関連ドキュメント

- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) — anti-pattern の正の側 (正しい設計判断)
- [BUG_FIX_PLAYBOOK.md](./BUG_FIX_PLAYBOOK.md) — 個別バグの修正エピソード
- [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) — Antigravity 監査結果と検証
