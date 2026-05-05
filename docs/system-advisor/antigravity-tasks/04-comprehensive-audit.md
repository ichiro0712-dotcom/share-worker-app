# 04 — System Advisor 徹底監査依頼書

**対象**: TASTAS の System Advisor (`/system-admin/advisor`) 機能群全体
**目的**: 第三者 (Antigravity) による独立監査で、Claude Code の継続開発で見落とした品質・コスト・性能・UX 課題を発見する
**想定実行時間**: 8〜16 時間 (深さによる)
**前提**: 監査のみ。コード変更・PR 作成・デプロイは絶対に行わない (レポートだけ提出)

---

## 0. 立ち位置と心構え

あなたは **独立した第三者監査エンジニア**として、TASTAS の System Advisor 機能を厳しく評価する。
- 開発者が無意識に許容している妥協を発見すること
- 「動いている」と「正しい/効率的/安全」を区別すること
- 推測ではなく、コードとログとドキュメントの**証拠**で語ること

**NG**:
- 推測ベースの「〜の可能性がある」だけのレポート (再現条件を示すこと)
- 既知の制約を「問題」として再列挙する (KNOWLEDGE.md と HANDOFF.md を読んで除外)
- 些末なコーディングスタイル指摘 (本質的でない)

---

## 1. 必読ドキュメント (この順番で読む)

監査着手前に **必ず以下を全部読む**。読まずに監査を始めると過去の議論をなぞるだけになる。

1. `CLAUDE.md` (リポジトリルート) — プロジェクトのルール・禁止事項
2. `docs/system-advisor/README.md`
3. `docs/system-advisor/HANDOFF.md` — **時系列の作業ログ**(直近 3〜5 セッション分は重要)
4. `docs/system-advisor/KNOWLEDGE.md` — 累積した設計知見・既知の制約
5. `docs/system-advisor/architecture.md` — 全体アーキテクチャ
6. `docs/system-advisor/REPORT_FEATURE.md` — Canvas + レポート機能設計
7. `docs/system-advisor/system-prompt.md` — Anthropic 用システムプロンプト
8. `docs/system-advisor/tools-spec.md` — 各ツール仕様
9. `docs/system-advisor/data-model.md` — DB スキーマ
10. `docs/system-advisor/security-cost.md`
11. `docs/system-advisor/HUB_PLATFORM_MIGRATION_TODO.md` — 将来の hub-platform 統合方針

**読みながら作業ノートを取り、KNOWLEDGE.md に既に記載済みの議題は監査対象から外すこと。**

---

## 2. 外部リサーチ (監査前に最新情報を確認)

監査の質はベンチマーク次第。以下を **WebFetch / WebSearch で最新情報を取得**してから本監査に入る。

### 2.1 Canvas / Artifact 系 LLM UX の最新仕様
- **Google Gemini Canvas** (公式ドキュメント or 実装例): どのように LLM とドキュメント編集が連携するか、どこに最先端の UX があるか
- **OpenAI ChatGPT Canvas**: 同上、特に「部分編集 + バージョン管理」の挙動
- **Claude Artifacts** (Anthropic): 同上、特に「コード生成系 vs 文書系」の違い

→ 各 3 つを比較表にし、TASTAS の Canvas (`src/components/advisor/report/report-canvas.tsx`) がどの方式に近いか、何が遅れているかを明記。

### 2.2 LLM エージェントの最新設計
- **Anthropic 公式の Tool Use / Computer Use** ベストプラクティス (最新)
- **OpenAI の Realtime API / Function Calling** (比較対象)
- **MCP (Model Context Protocol)** の最新仕様 — TASTAS は将来 hub-platform 統合で MCP 連携予定 ([HUB_PLATFORM_MIGRATION_TODO.md](../HUB_PLATFORM_MIGRATION_TODO.md))
- **エージェントメモリ設計** (Working / Episodic / Semantic / Procedural) の業界標準

→ TASTAS の orchestrator (`src/lib/advisor/orchestrator.ts`) が現代的設計に沿っているか評価。

### 2.3 LLM コスト最適化
- **Anthropic Prompt Caching** (ephemeral cache TTL 5 分) の最新仕様 — どこまで効かせられるか
- **Tool 結果の cache_control** の制約
- **Gemini Context Caching** (Implicit / Explicit) の最新
- **トークン使用量モニタリング** のベストプラクティス

### 2.4 Next.js 14 App Router + Prisma + Supabase の最新ベストプラクティス
- Server Action のキャッシュ戦略 (`revalidatePath` / `revalidateTag` / `unstable_cache`)
- Edge Runtime vs Node Runtime の使い分け
- Streaming SSR / RSC の活用度
- Prisma + connection pooling (Supabase で IPv4 アドオン使用中)

---

## 3. 監査スコープ (実コードを読む対象)

### 3.1 主要ファイル

```
# DB スキーマ
prisma/schema.prisma  (Advisor* モデルすべて)

# Server / lib
src/lib/advisor/
├ orchestrator.ts          ← 最重要、tool ループ + Gemini バイパス
├ system-prompt.ts          ← cache 構造、モデル選択
├ models.ts                  ← モデル定義
├ auth.ts                    ← 認証
├ message-display.ts         ← [TOOL:xxx] 剥がし
├ llm/
│  ├ gemini.ts               ← Gemini SDK ラッパー
│  ├ gemini-draft-create.ts  ← 初回ドラフト Gemini バイパス
│  ├ gemini-edit.ts           ← ドラフト編集 (revise)
│  ├ gemini-result-edit.ts    ← レポート本文編集
│  ├ chat-history-context.ts  ← 履歴を Gemini に渡す
├ persistence/
│  ├ report-drafts.ts
│  ├ report-versions.ts       ← share_token / shared_until 含む
│  ├ sessions.ts
│  ├ messages.ts
│  ├ audit.ts
├ actions/
│  ├ conversations.ts          ← toggleBookmark 含む
│  ├ report-drafts.ts
│  ├ report-versions.ts        ← enableShare / extendShare 含む
├ reports/
│  ├ collect.ts                ← データ収集 (並列展開)
│  ├ generate.ts                ← Gemini レポート生成本体
│  ├ notify-google-chat.ts (削除済み、参照なきこと確認)
├ tools/
│  ├ registry.ts                ← Anthropic ツール定義集約
│  ├ tastas-data/                ← 本番 DB アクセス系
│  ├ search/
│  ├ logs/

# API ルート
app/api/advisor/
├ chat/route.ts
├ report/generate/route.ts
└ ...

app/api/cron/
└ advisor-cleanup/route.ts     ← 保持期間 cron (新規)

# 公開シェア
app/advisor/r/[token]/page.tsx ← 認証なし公開ページ

# UI コンポーネント
src/components/advisor/
├ chat/
│  ├ chat-layout.tsx            ← 最大、サイドバー + チャット + Canvas 統合
│  ├ chat-input.tsx             ← ツール選択 + プリフィル
│  ├ unified-message.tsx
│  ├ markdown-table.tsx
├ report/
│  └ report-canvas.tsx          ← 最重要、ヘッダー + 編集 + 共有 + しおり
├ history/
│  └ history-client.tsx
├ reports/
│  └ report-detail.tsx
```

### 3.2 監査対象外
- `node_modules`, `.next`, `_legacy_*`
- TASTAS の Advisor 以外の機能 (求人マッチング本体)

---

## 4. 監査の柱 (8 つの観点)

各柱について、**「証拠 (該当ファイルパス + 行番号 or git hash)」「重大度 (P0 / P1 / P2)」「再現条件」「修正案」**を含めてレポートする。

### 4.1 ✅ Canvas / Agent 仕様の最新性チェック

§2.1 / §2.2 で得た最新仕様と TASTAS の実装を突き合わせ:

- [ ] Canvas は最新の差分編集パラダイム (例: Gemini Canvas の「直接編集 + LLM 提案」) に対応しているか
- [ ] バージョン管理 (`AdvisorReportVersion`) はコミュニティ標準と比べて遅れていないか
- [ ] orchestrator のツールループは Anthropic / OpenAI の最新ベストプラクティスを踏襲しているか
- [ ] MCP 連携を見据えた抽象化が始まっているか (= 将来コスト)

### 4.2 🐛 バグ・潜在バグ

- [ ] **競合状態 (race condition)**: Canvas のポーリング + 編集 + 楽観的 UI で起きうる race
- [ ] **メモリリーク**: useEffect cleanup の漏れ、AbortController の未開放
- [ ] **null / undefined ガード漏れ**: `activeVersion?.lockedByOther` 等の誤判定経路
- [ ] **JST 時刻の扱い**: `[CLAUDE.md](../../CLAUDE.md)` の必須ルール違反 (UTC で比較してる箇所がないか)
- [ ] **SSE ストリーム異常終了**: ネットワーク切断・タイムアウト時に UI が固まらないか
- [ ] **トランザクション漏れ**: `createReportVersion` 等、複数テーブル更新が atomic でない箇所
- [ ] **権限チェック漏れ**: admin_id が他人のリソースを操作できる経路がないか
- [ ] **共有 URL の token 推測可能性**: `randomBytes(24)` のエントロピーは十分か、漏洩経路はないか

### 4.3 🗑 無駄なコード・データ

- [ ] **死コード**: import されているが呼ばれていない関数、コメントアウトされたまま放置のロジック
- [ ] **重複ロジック**: Canvas の Markdown レンダリング設定が 4 ファイルに散在 (集約候補)
- [ ] **使われていないテーブル/カラム**: `is_compacted` `context_summary` 等、設計したが未活用なフィールド
- [ ] **重複した SSE イベント**: orchestrator から送られる status イベントに無意味な重複がないか
- [ ] **削除候補ファイル**: `_legacy_*`, 廃止された `notify-google-chat.ts` 系の参照が残っていないか

### 4.4 🏗 非効率な設計

- [ ] **N+1 クエリ**: Prisma 呼び出しでループ内 query になっている箇所
- [ ] **不要な useEffect**: `[deps]` が誤っていて過剰再実行 / 過小再実行
- [ ] **state lifting の過剰/不足**: prop drilling や逆に上に上げすぎ
- [ ] **Polling 戦略**: Canvas の 2 秒間隔ポーリングは適切か、SSE で代替できないか
- [ ] **大きすぎるコンポーネント**: `report-canvas.tsx` 1,700 行超 / `chat-layout.tsx` 1,200 行超 — 分割の余地
- [ ] **Server Action vs API Route**: 適切に使い分けられているか

### 4.5 💰 トークンコスト無駄遣い

- [ ] **Anthropic Prompt Cache**:
  - `cachedPart` (system prompt) と `dynamicPart` の分離は最適か
  - `cache_control: ephemeral` が tools 配列にも付いているか
  - 5 分 TTL を意識した呼び出し頻度になっているか (TTL 切れで全部 cold cache 再構築してないか)
  - cacheReadInputTokens / cacheCreationInputTokens の比率を audit ログから検算
- [ ] **Gemini Context Caching**:
  - 大きい collected_data を毎回 Gemini に送ってないか (gemini-2.5-flash で context caching が使えるか確認)
- [ ] **無駄な LLM 出力**:
  - tool ループで `max_tokens` 制限が適切か (loop=1 で 512 制限の効果検証)
  - 中間 assistant メッセージで冗長な前置き (「承知しました」「以下の通りです」) を生成してないか
- [ ] **不要な data 添付**:
  - generate.ts で 50KB 制限してるが、metric_keys 全部展開で 50KB を超えるパターンが頻発してないか
  - Search Console / GA4 の不要な dimension が混ざってないか
- [ ] **トークン使用量の可視化**:
  - `AdvisorAuditLog.payload.usage` で集計可能か、ダッシュボード化されているか

### 4.6 ⚡ 速度改善ポイント

- [ ] **TTFB の実測**: `scripts/advisor-latency-trace.ts` で直近 N セッションの loop 単位 TTFB を集計し、ボトルネックを特定
- [ ] **並列化漏れ**: collect.ts の `Promise.all` 並列展開は完全か、直列実行が残ってないか
- [ ] **無駄なポーリング**: Canvas が編集中もポーリング動いてないか (DB 上書き事故防止)
- [ ] **初回マウント時の重い処理**: ChatInput / ReportCanvas のマウント時に直列で複数 Server Action を呼んでないか
- [ ] **キャッシュ可能なフェッチ**: `getAdvisorSettings` 等、毎リクエスト DB アクセスしている箇所を unstable_cache 化できるか
- [ ] **レンダリング**: 大量メッセージ表示時の React reconciliation コスト
- [ ] **モデル切替の効果**:
  - Sonnet 4.6 vs Sonnet 4 vs Haiku 4.5 の使い分けは妥当か
  - loop=0 (主応答) と loop>0 (ツール後) でモデル切替する戦略の検討

### 4.7 🎨 UI/UX 最新化

§2.1 で得た Gemini Canvas / ChatGPT Canvas / Claude Artifacts と比較:

- [ ] **Canvas のフッター/ヘッダー**: アクション配置が最先端と比べて直感的か
- [ ] **チャット側の見せ方**: ストリーミング表示 / プログレスインジケータ / トークン消費表示
- [ ] **モバイル対応**: `lg:` breakpoint で Canvas が消える挙動は妥当か (現状はモバイル考慮なし)
- [ ] **アクセシビリティ**: aria-label / role / focus-trap / キーボード操作
- [ ] **エラー表示**: 「失敗、再試行を」と出るだけで、ユーザーが何をすればいいか不明な箇所はないか
- [ ] **空状態 (Empty state)**: 初回ユーザーが迷わないか
- [ ] **しおり / 共有 / 期限切れ**: ユーザーが状態を理解できる UI になっているか

### 4.8 🔒 その他の徹底監査ポイント

- [ ] **セキュリティ**:
  - SSRF (URL fetch ツールの入力検証)
  - SQL injection (Prisma 使用なので原則安全だが `$queryRawUnsafe` 使用箇所を確認)
  - 公開シェア URL の Indexing 防止 (robots.txt / noindex meta)
  - admin の権限昇格パス
- [ ] **エラー処理**:
  - 「Anthropic credit balance too low」のような外部エラーが起きた時の UI フィードバック
  - Gemini API 失敗時のフォールバック (撤去済みだが、すべての経路で正しく実装されているか)
- [ ] **テスト**:
  - 自動テストの存在 / カバレッジ
  - 重要シナリオの E2E が組まれているか
- [ ] **ログ・監査**:
  - `AdvisorAuditLog` の payload スキーマは将来分析に耐えるか (kind / event_type の命名規則の一貫性)
- [ ] **デプロイ準備**:
  - ステージング / 本番展開チェックリスト ([DEPLOY_CHECKLIST.md](../DEPLOY_CHECKLIST.md)) は実際に網羅的か
  - 環境変数の管理 (`.env.example` 更新漏れ等)
- [ ] **将来統合への準備**:
  - hub-platform 統合 ([HUB_PLATFORM_MIGRATION_TODO.md](../HUB_PLATFORM_MIGRATION_TODO.md)) を見据えた抽象化が始まっているか
  - Phase 3 着手時にコピーしやすい構造になっているか (= TASTAS 固有性が一箇所に集まっているか)

---

## 5. 成果物

### 5.1 監査レポート (Markdown)

`docs/system-advisor/AUDIT_REPORT_2026-MM-DD.md` という名前で作成。

#### フォーマット

```markdown
# System Advisor 徹底監査レポート

**監査日**: YYYY-MM-DD
**対象コミット**: <git rev-parse HEAD>
**監査者**: Antigravity (LLM)
**所要時間**: N 時間

## エグゼクティブサマリ
- P0 (即対応必要): N 件
- P1 (近日中対応): N 件
- P2 (将来対応): N 件
- 主要発見: 3 行で要約

## 0. 外部リサーチ結果 (§2)
### 0.1 Canvas / Artifact 系比較
| 項目 | Gemini Canvas | ChatGPT Canvas | Claude Artifacts | TASTAS Canvas |
|---|---|---|---|---|
| ... | | | | |

### 0.2 LLM エージェント設計の最新動向
...

### 0.3 LLM コスト最適化
...

## 1. ✅ Canvas / Agent 仕様の最新性
### 1.1 [P1] xxxx
- **証拠**: `src/lib/advisor/orchestrator.ts:340-380`
- **問題**: ...
- **再現**: ...
- **修正案**: ...
- **コスト**: 工数 / 影響範囲

(以下、各観点ごとに繰り返し)

## 2. 🐛 バグ・潜在バグ
...

## 3. 🗑 無駄なコード・データ
...

## 4. 🏗 非効率な設計
...

## 5. 💰 トークンコスト
...

## 6. ⚡ 速度改善
...

## 7. 🎨 UI/UX
...

## 8. 🔒 その他
...

## 9. 優先順位付き対応マップ

| # | 重大度 | タイトル | 推定工数 | 関連ファイル |
|---|---|---|---|---|
| ... | | | | |

## 10. 監査の限界 / 未監査領域
- 実機での負荷テスト未実施
- ... (監査者が確証を持てなかった領域は明示)
```

### 5.2 補助成果物 (任意)

- `claudedocs/audit/canvas-comparison.md` — Canvas 比較の詳細調査ノート
- `claudedocs/audit/cost-analysis.md` — トークンコスト試算 (audit ログのサンプル分析)
- `claudedocs/audit/refactor-candidates.md` — 大きいファイルの分割提案

---

## 6. 監査者への注意事項 (CLAUDE.md ルール)

以下は **絶対遵守**。違反した時点で監査結果は無効。

- [ ] **コードを変更しない** (Read のみ、Edit/Write は監査レポートのみ)
- [ ] **`git push` しない** (PR 作成しない)
- [ ] **本番/ステージング DB に触らない** (`prisma db push` 等禁止、Read もしない)
- [ ] **Vercel 環境変数を変更しない**
- [ ] **シークレット (API キー / トークン / .env*) をレポートに転記しない**
- [ ] **監査レポート以外のドキュメントを書き換えない** (HANDOFF.md / KNOWLEDGE.md は手を出さない、Claude Code が後で取り込む)
- [ ] **不確かなことは「未確定」と明記** (推測で断定しない)

---

## 7. 推奨実行順序

1. §1 必読ドキュメント全読 (1〜2 時間)
2. §2 外部リサーチ (1〜2 時間) — 比較表の素材
3. §3 主要ファイル静的解析 (3〜5 時間) — grep / read で穴を探す
4. §4 観点別監査 (3〜5 時間) — 8 つの柱を順番に
5. §5 レポート執筆 (1〜2 時間)

**1 セッションで終わらない場合**: 部分提出可。「現時点で確認できた範囲」と「残タスク」を明示すること。

---

## 8. 完了の定義

以下を満たせば完了:
- [ ] §5.1 のレポートが `docs/system-advisor/AUDIT_REPORT_YYYY-MM-DD.md` に存在
- [ ] エグゼクティブサマリ + 8 つの柱が埋まっている
- [ ] P0/P1/P2 の重大度が付いている
- [ ] 各指摘に証拠 (ファイル + 行番号 or 引用) がある
- [ ] 優先順位付き対応マップが付いている
- [ ] 「監査の限界」セクションで未確認領域を明示している

---

## 9. 想定 Q&A (Antigravity が迷うかもしれない点)

**Q: ローカルで動かして検証できる?**
A: 動作確認は最小限で。dev サーバを立ち上げての E2E は不要。**コードと音 (= ログ / 監査) の静的解析がメイン**。

**Q: SaaS 化 (hub-platform 統合) を見据えた評価が必要?**
A: §4.8 で言及。ただし「現時点の TASTAS Advisor の品質」を主眼にする。SaaS 化は将来計画なので付随評価で十分。

**Q: モデルやプロンプト本体の評価は?**
A: §4.5 と §1 で扱う。「現状のプロンプトが意図した出力を引き出しているか」「キャッシュ効率」を見る。

**Q: コードの「美しさ」も評価?**
A: 不要。「動かない / 無駄 / 危険」の 3 つに絞る。スタイル指摘は P2 に格下げ。

---

## 10. 関連リンク

- [HANDOFF.md](../HANDOFF.md) — セッションログ
- [KNOWLEDGE.md](../KNOWLEDGE.md) — 既知の設計判断
- [HUB_PLATFORM_MIGRATION_TODO.md](../HUB_PLATFORM_MIGRATION_TODO.md) — 将来計画
- [REPORT_FEATURE.md](../REPORT_FEATURE.md) — Canvas + レポート機能仕様
