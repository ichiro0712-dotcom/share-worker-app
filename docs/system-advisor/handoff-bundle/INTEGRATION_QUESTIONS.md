# INTEGRATION_QUESTIONS — hub-platform 側 LLM への質問リスト

**作成**: 2026-05-04
**回答者**: hub-platform 側 LLM (Claude / その他)
**目的**: TASTAS Advisor を hub-platform にどう統合するか、**統合方針を決めるための材料を集める**

---

## 0. 回答方針

- **推測ではなく**、hub-platform の現状コード / ドキュメントを **実際に確認**して回答してください
- 「分からない」「未確認」は明示してください (適当な推測より遥かに価値あり)
- 各質問の末尾に **(優先度: 高 / 中 / 低)** を付けます。高から順に回答してください
- 回答形式は `Q[番号]: [質問]` → `A: [回答]` で揃えてください
- 必要なら追加質問を末尾に追記してください (`Q-NEW-1` 等)

---

## 1. アーキテクチャ全体 (優先度: 高)

### Q1: hub-platform の `apps/agent-hub` は既に Orchestrator + Canvas + マルチエージェントを実装しているとのこと。TASTAS Advisor の機能 (チャット + Canvas + レポート + Gemini バイパス) と **どこまで重複** していて、**何が agent-hub に無いか** を明示してください

特に確認してほしいもの:
- agent-hub の Canvas は「ドラフト要件 + 0 埋め skeleton」の概念があるか？
- agent-hub に Gemini バイパスのような重い処理を別 LLM に逃がす仕組みがあるか？
- agent-hub の Orchestrator は Anthropic loop=1 TTFB 100 秒問題に当たったことがあるか？対策しているか？

### Q2: hub-platform の現状で「**packages/advisor-core** を新設すべき箇所」と「agent-hub に直接統合すべき箇所」を分けてください

選択肢:
- **(a) 全部 packages/advisor-core**: Canvas / orchestrator / tool-registry / Gemini バイパス を core 化、各 Hub が import
- **(b) agent-hub に統合**: TASTAS Advisor を agent-hub の 1 機能として吸収、各 Hub からは agent-hub に問い合わせ
- **(c) MCP 化**: TASTAS は今のまま残し、agent-hub から MCP 経由で「TASTAS の指標を取って」と問い合わせる

それぞれの工数 / リスク / メリットを評価してください。

### Q3: hub-platform はマルチテナント (`agent_hub.*` / `project_hub.*` / `health_hub.*` schema 分離) とのこと。**TASTAS Advisor のテーブル群** (advisor_chat_sessions / advisor_report_drafts 等) はどの schema に置くべき？

- `advisor.*` schema を新設する？
- 各 Hub schema 配下に置く？ (sushi_hub.advisor_chat_sessions / band_hub.advisor_chat_sessions 等)
- データ分離の単位は organization_id ベース？user_id ベース？

---

## 2. Canvas / UI (優先度: 高)

### Q4: TASTAS Advisor の Canvas (`docs/06_UI_BEHAVIOR_SPEC.md` 参照) を hub-platform 側で **完全再現** したいです。agent-hub の既存 Canvas と統合できますか？

- agent-hub の Canvas はどんな UI 仕様か？(同じ角丸カード化 / ヘッダー 1 行集約か？)
- 統合する場合、TASTAS の状態専用ヘッダー (drafting / updating / generating で「⏳ ○○中... + 中止」) は agent-hub にも持っていける？
- TASTAS のしおり (永続保存) / 共有 URL (有効期限 30 日) は agent-hub にも欲しいか？

### Q5: TASTAS の Canvas は「skeleton_markdown を 0 埋めの表骨格として LLM が書く → 本文生成で実数値を埋める」という 2 段階方式です。agent-hub の Canvas もこの方式か？違う場合、**どちらを採用するか**

→ ユーザー (川島) の希望は「TASTAS の方式を完全再現」(細かくチューニング済み)。agent-hub 側を寄せられるか、両方サポートするか、議論。

### Q6: TASTAS の 19 ツール (Core 5 + TASTAS Data 5 + External 5 + Future 2 + Reports 2) のうち、**agent-hub に既にあるもの** はどれ？重複ツールはどう統合する？

特に確認してほしいツール:
- `query_ga4` / `query_search_console` / `get_supabase_logs` / `get_vercel_logs` / `get_recent_commits`

---

## 3. データ管理 (優先度: 中)

### Q7: TASTAS の保持期間 cron (`/api/cron/advisor-cleanup` 毎日 04:00 JST) は hub-platform でも採用するか？

- しおりなしセッションの Draft / Versions: 30 日で削除
- Audit ログ: 90 日 (report 系は 180 日)
- 失効済み share_token: 即時 null 化

agent-hub は同様の cron を持っているか？統合する？

### Q8: TASTAS は本番 DB 読み取り専用接続 (`advisor_readonly` ロール + `runReadOnly()` 二重防御) を使っています。hub-platform でも同等の防御方式を採用するか？

- agent-hub が業務データにアクセスする方式を確認
- 各 Hub (sushi-hub / band-hub) の業務データへの読み取り専用接続をどう作るか

---

## 4. LLM 呼び出し (優先度: 高)

### Q9: TASTAS は **Anthropic + Gemini の二本立て** (DESIGN_DECISIONS §1.1) です。hub-platform はどんな LLM 構成か？統合する場合、TASTAS の Gemini バイパスをどう移植するか？

特に確認:
- agent-hub の現状の LLM プロバイダ (Anthropic / OpenAI / その他)
- prompt cache (5 分 ephemeral) を活用しているか？
- TTFB の問題は経験しているか？

### Q10: TASTAS の `[TOOL:report_create|draft_revise|result_edit]` hidden hint 方式は移植可能か？hub-platform 側で同等のメカニズムが既にあるか？

---

## 5. ナレッジ継承 (優先度: 中)

### Q11: 本パッケージの [knowledge/](./knowledge/) 配下のナレッジ (DESIGN_DECISIONS / ANTI_PATTERNS / BUG_FIX_PLAYBOOK 等) を hub-platform 側のドキュメント体系に **どう吸収するか**？

- そのまま `packages/advisor-core/docs/` に持っていく？
- agent-hub の既存ドキュメントとマージする？
- 「TASTAS 由来のナレッジ」として独立して残す？

### Q12: TASTAS の **anti-patterns** (Anthropic フォールバック復活させない / ポーリング停止条件作らない / skeleton で固有名禁止 等) は hub-platform 全体に適用すべきか？

→ 一般化できるものは hub-platform 全体のコーディング規約に取り込み、TASTAS 固有のものは `apps/tastas-hub/` 配下に残す等の整理が必要。

---

## 6. Phase 別の実行順序 (優先度: 中)

### Q13: 既存の Phase 計画 (`HANDOFF_FROM_TASTAS.md §2.4` 参照: Phase 3 → 4 → 5 → 6 → 7 → 8) を hub-platform 側から見ると **どこから始めるのが現実的** ですか？

選択肢:
- **(a) Phase 4 (advisor-core 抽出) を先にやる**: TASTAS のコードを packages 化してから各 Hub に展開
- **(b) Phase 5 (sushi-hub 立ち上げ) を先にやる**: 小さい新規 Hub で advisor-core 抽出のドッグフード
- **(c) Phase 7 (TASTAS 統合) を最後に**: 既存 TASTAS の安定運用を保ったまま新規 Hub から進める

### Q14: hub-platform の現状 Phase 状態は？(agent-hub / project-hub / health-hub の安定度、技術的負債、優先タスク等)

→ TASTAS との統合タイミングを決める材料

---

## 7. 運用 (優先度: 低)

### Q15: hub-platform 側で **誰が Advisor を使うか** (= テナント / ロール設計)。TASTAS は System Admin 専用だが、hub-platform はマルチテナントなので別途設計が必要

- organization_id ベースでテナント分離
- ロールは `org_admin` / `org_member` / `org_viewer` 等？
- 課金プラン別にしおり数 / 保持期間を変える？

### Q16: hub-platform 側で **コスト管理** をどうするか？

- TASTAS は `AdvisorUsageDaily` で admin × 日付ごとに集計、`checkCostCap` で 1 日の上限ガード
- hub-platform はテナント別 / プラン別の上限管理が必要？
- agent-hub に既にある `packages/llm-usage` を流用できる？

---

## 8. 開発体制 (優先度: 低)

### Q17: TASTAS Advisor のドキュメント体系 (KNOWLEDGE.md / HANDOFF.md / セッションログ) を hub-platform 側にも導入するか？

- TASTAS の HANDOFF.md は時系列セッションログ、agent-hub にも同様の運用がある？
- 「失敗 → 修正のエピソード集」(BUG_FIX_PLAYBOOK 形式) を継続的に蓄積する仕組み

---

## 9. ユーザー (川島) からの追加要望

質問にあがっていない要望や懸念があれば追記:

(空欄)

---

## 10. 期待する回答スタイル

```markdown
# INTEGRATION_QUESTIONS への回答 (hub-platform 側 LLM)

## Q1: 機能重複と差分

A:
- agent-hub の Canvas は ... (実コード参照: apps/agent-hub/...)
- TASTAS Advisor との重複: ...
- 不足機能: ...
- 推奨統合方針: ...

## Q2: 統合方針 (a/b/c) の評価

A:
- (a) packages/advisor-core: 工数 X 週、リスク ..., メリット ...
- (b) agent-hub に統合: ...
- (c) MCP 化: ...
- 推奨: (a) または (b)、理由 ...

(以下、Q3 〜 Q17 まで)

---

## 追加で必要な調査 / 質問

- ユーザー (川島) に確認したいこと: ...
- TASTAS 側コードで追加調査が必要な部分: ...
```

---

## 11. 回答後のフロー

1. hub-platform 側 LLM が本ドキュメントに回答を追記
2. ユーザー (川島) が回答を読んで議論ポイントを整理
3. TASTAS 側 Claude Code と hub-platform 側 LLM 間で必要なら Q&A
4. 統合方針確定 → Phase 4 (advisor-core 抽出) 等の具体タスク作成

---

## 12. 関連ドキュメント

- [README.md](./README.md) — このパッケージの全体構成
- [HANDOFF_FROM_TASTAS.md](./HANDOFF_FROM_TASTAS.md) — 議論経緯
- [knowledge/DESIGN_DECISIONS.md](./knowledge/DESIGN_DECISIONS.md) — TASTAS の設計判断 (絶対理解してから回答)
- [docs/06_UI_BEHAVIOR_SPEC.md](./docs/06_UI_BEHAVIOR_SPEC.md) — UI 完全マッピング
