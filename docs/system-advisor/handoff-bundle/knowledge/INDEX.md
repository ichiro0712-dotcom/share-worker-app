# ナレッジ INDEX

**目的**: TASTAS Advisor 開発で得た **「失敗した経験 + 設計判断」** を、後発の人 (= hub-platform 側) が
同じ失敗を繰り返さないように整理。

---

## 読書順 (推奨)

1. **[DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)** ★ — なぜこの設計か (Gemini バイパス / Anthropic フォールバック撤去 等)
2. **[ANTI_PATTERNS.md](./ANTI_PATTERNS.md)** ★ — やってはいけないこと (再発防止)
3. **[BUG_FIX_PLAYBOOK.md](./BUG_FIX_PLAYBOOK.md)** ★ — 過去のバグ → 修正のエピソード集
4. [PROMPT_PATTERNS.md](./PROMPT_PATTERNS.md) — プロンプト設計の教訓
5. [DATA_COLLECTION_PATTERNS.md](./DATA_COLLECTION_PATTERNS.md) — collect.ts の教訓
6. [LATENCY_HISTORY.md](./LATENCY_HISTORY.md) — 速度改善の歴史
7. [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) — Antigravity 監査 + 検証結果

---

## カテゴリ別索引

### アーキテクチャ判断
- なぜ Anthropic + Gemini の二本立てか → DESIGN_DECISIONS §1
- なぜ Anthropic フォールバックを撤去したか → DESIGN_DECISIONS §1.2
- なぜ get_report_draft / list_available_metrics を廃止したか → DESIGN_DECISIONS §2

### プロンプト設計
- 「迷ったら更新する側に倒す」 → PROMPT_PATTERNS §2
- 「✅ / ❌ 具体例併記」 → PROMPT_PATTERNS §3
- 「skeleton で固有名禁止」 → PROMPT_PATTERNS §5 + ANTI_PATTERNS §3

### データ収集
- ツール能力フル展開 → DATA_COLLECTION_PATTERNS §1
- 過去バージョン編集の継承 → DATA_COLLECTION_PATTERNS §2

### バグ集
- Context Freeze バグ (orderBy: 'asc' で最古 100 件しか取らない) → BUG_FIX_PLAYBOOK #1
- LP 名取得バグ → BUG_FIX_PLAYBOOK #2
- JST 境界処理 → BUG_FIX_PLAYBOOK #3
- ChatInput prefill 重複適用 → BUG_FIX_PLAYBOOK #4
- disabled button の tooltip 消失 → BUG_FIX_PLAYBOOK #5
- Markdown bullet が消える → BUG_FIX_PLAYBOOK #6
- ポーリング無限ループの恐れ → BUG_FIX_PLAYBOOK #7
- 「例として書いた架空指標」を Gemini が信じる → BUG_FIX_PLAYBOOK #8
- ChatInput 再マウントによる prefill 競合 → BUG_FIX_PLAYBOOK #4 (再掲)
- Anthropic loop=1 TTFB 100 秒問題 → LATENCY_HISTORY §1

### やってはいけないこと
- Anthropic フォールバック復活 → ANTI_PATTERNS §1
- ポーリング停止条件作成 → ANTI_PATTERNS §2
- skeleton で固有名 → ANTI_PATTERNS §3
- Postgres 集計を SQL で雑に書き換え → ANTI_PATTERNS §4
- 自動モデル置換 → ANTI_PATTERNS §5
- Vercel env / 本番 DB 直接操作 → ANTI_PATTERNS §6

### 速度
- Phase A-D の改善履歴 → LATENCY_HISTORY §2
- prompt cache 5 分 ephemeral → LATENCY_HISTORY §3
