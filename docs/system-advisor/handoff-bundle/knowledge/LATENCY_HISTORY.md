# LATENCY_HISTORY — 速度改善の歴史

**作成**: 2026-05-04
**目的**: TASTAS Advisor の TTFB / レイテンシ改善の試行錯誤を記録。
hub-platform 側で同じ罠を踏まないため。

---

## 1. 出発点: Anthropic loop=1 TTFB 100 秒問題

### 症状
ツール実行後の最終応答 (loop=1) で TTFB が 90〜130 秒になる事象が頻発。
ユーザーが 2 分待たされる。

### 計測ツール
```bash
npx tsx scripts/advisor-latency-trace.ts          # 直近セッションの時系列内訳
grep advisor:trace /tmp/advisor-dev.log | tail   # ループ単位の詳細トレース
```

### ジッター分析 (2026-05-03)
`scripts/advisor-jitter-analysis.ts` で判明:
- 遅い 7 件すべてが loop=1
- cacheRead 中央値 60,898 tokens (キャッシュは効いている)
- cacheCreate 中央値 493 tokens (完全な再書き込みではない)
- 速かった 2 件 (TTFB 1〜2 秒) は同一セッション内の連続リクエストのみ
- → **Anthropic 側のロードバランサーがキャッシュ KV を持つノードと別ノードにルーティング** し、リハイドレーション (中央ストアから VRAM への物理転送) で 90〜130 秒待たされている
- → **こちら側では制御不能**

### 否定された対策
| 試した対策 | 結果 |
|---|---|
| TTL 5 分切れの仮説 | × cacheCreate 中央値 493 (完全再計算なら 50K+) |
| ランダム揺らぎの仮説 | × 7 件全て loop=1 に集中 |
| Sonnet 4 → Sonnet 4.6 切替 | × 効果なし |
| `thinking: { type: 'disabled' }` | × 効果なし |
| prompt cache 化 | × cache は効いているのに遅い |
| dynamic prompt 化 | × 効果なし |
| `max_tokens=512` 制限 | × 効果なし |

---

## 2. Phase 別改善履歴

| Phase | 対応 | TTFB 改善 |
|---|---|---|
| 初期 | Anthropic loop=1 で update_report_draft → 複数 round trip | 100 秒級 |
| **Phase A** | `[TOOL:draft_revise]` を Gemini 直叩きにバイパス | 4〜10 秒 |
| **Phase B** | `[TOOL:report_create]` も Gemini 直叩きに拡張 | 9 秒前後 |
| **Phase C** | `[TOOL:result_edit]` 経路新設 | 5〜10 秒 |
| **Phase D** | auto-redraft (result_edit → draft_revise → 再生成) 自動化 | 40 秒前後 (3 段階の合計) |

レポート生成本体 (`/api/advisor/report/generate`) は **15〜25 秒で安定**。

### バイパス分岐の仕組み
ユーザー入力先頭の hidden hint で `orchestrator` が分岐:
```typescript
// src/lib/advisor/orchestrator.ts:344-368
if (trimmed.startsWith('[TOOL:report_create]')) {
  return await callGeminiBypass('createDraft', ...)
} else if (trimmed.startsWith('[TOOL:draft_revise]')) {
  return await callGeminiBypass('editDraft', ...)
} else if (trimmed.startsWith('[TOOL:result_edit]')) {
  return await callGeminiBypass('editResult', ...)
}
// それ以外 → 通常の Anthropic ツールループ
```

---

## 3. prompt cache 5 分 ephemeral 戦略

`buildCachedSystem(cachedPart, dynamicPart)` で system prompt を **2 つに分割**:

### cachedPart (キャッシュされる)
- ROLE_AND_MISSION
- CRITICAL_CONSTRAINTS
- TOOLS_HINT
- buildMetricsCatalogSection() — METRIC_CATALOG を Markdown 表で展開
- RESPONSE_STYLE
- SAFETY_FALLBACK
- プロジェクト知識ブロック (CLAUDE.md / schema.prisma / docs)

→ `cache_control: { type: 'ephemeral' }` で 5 分間 cache される

### dynamicPart (毎回変わる)
- このセッションの情報 (質問者 / 現在時刻 / セッション ID)
- 現在のレポートドラフト状態 (ドラフトがあれば)
  - original_request / 要件メタ / outline / notes / skeleton_markdown

cacheRead が効いていれば cacheReadInputTokens >= 27,000+ になるので、audit ログで効果検証可能。

実装: `src/lib/advisor/system-prompt.ts` / `src/lib/advisor/prompt-cache.ts`

---

## 4. ツール往復削減

### 廃止したツール
| ツール | 廃止理由 |
|---|---|
| `get_report_draft` | dynamic system prompt にドラフト全体を埋め込むため不要に |
| `list_available_metrics` | METRIC_CATALOG を cachedPart に静的埋め込みするため不要に |

### 効果
- ツール 1 個減ると loop が 1 個減る = TTFB が改善
- 静的データは context に埋める (cacheRead で再送コスト無料)
- 動的データだけツール呼び出し

---

## 5. ポーリングの段階化

Canvas のポーリングを **アクティブ時 2 秒 / idle 時 8 秒** に変更 (2026-05-04)。

### 効果
- アイドル中の DB / Function 呼び出しを 1/4 に削減
- アクティブ時 (進捗反映必要) は 2 秒で速い

### 重要: 「停止」は絶対やらない
理由: [ANTI_PATTERNS.md §2](./ANTI_PATTERNS.md)

---

## 6. その他の最適化

### 6.1 collect.ts の並列実行
`Promise.all` で全データソースを並列実行 → 所要時間は最遅リクエストで律速。

### 6.2 出力 50KB cap
各ツール戻り値を 50,000 文字で truncate → Gemini context を肥大化させない。

### 6.3 OOM ガード (take=100k)
`aggregateByDay` の findMany に `take: 100_000` 上限。
詳細: [BUG_FIX_PLAYBOOK.md #3](./BUG_FIX_PLAYBOOK.md)

---

## 7. 計測スクリプト

| スクリプト | 用途 |
|---|---|
| `scripts/advisor-latency-trace.ts` | セッション時系列分析 |
| `scripts/advisor-detailed-audit.ts` | audit_log 全件ダンプ |
| `scripts/advisor-jitter-analysis.ts` | TTFB ジッター分析 (loop 別) |
| `scripts/check-metrics-consistency.ts` | METRIC_CATALOG ↔ query-metric.ts 整合性 CI |

これらは hub-platform 側にも持っていく価値あり (advisor-core の検証用)。

---

## 8. 将来の改善余地 (採用していない)

### 8.1 サーバー組立短絡 (案 A)
update_report_draft ツールの実行後、loop=1 を呼ばずにサーバー側で `fields_updated` 配列から動的メッセージを組み立てて短絡する案。

**保留理由**: 部分対策に留まる + ユーザーから「機械的」と指摘の歴史
**詳細**: [HANDOFF.md §3 (TASTAS 側)] 参照 (本パッケージには含まれていない、必要なら聞く)

### 8.2 SSE での Canvas 状態同期
2 秒ポーリングを SSE Push に置き換え。
**保留理由**: 大規模リファクタ。SSE 化を独立タスクで対応する方針。
**短期改善**: 段階的ポーリングで対処済み (本ファイル §5)。

### 8.3 Postgres 集計化 (`aggregateByDay` の SQL 化)
**保留理由**: JST 境界処理の事故リスク
**現状**: take=100k OOM ガードのみ
**詳細**: [BUG_FIX_PLAYBOOK.md #3](./BUG_FIX_PLAYBOOK.md), [ANTI_PATTERNS.md §4](./ANTI_PATTERNS.md)

---

## 関連ドキュメント

- [DESIGN_DECISIONS.md §1.1](./DESIGN_DECISIONS.md) — Anthropic + Gemini 二本立ての真因
- [BUG_FIX_PLAYBOOK.md #12-14](./BUG_FIX_PLAYBOOK.md) — TTFB 関連バグエピソード
- 実コード: `src/lib/advisor/orchestrator.ts` / `system-prompt.ts` / `llm/gemini-*.ts`
