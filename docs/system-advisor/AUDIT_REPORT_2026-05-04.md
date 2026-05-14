# System Advisor 徹底監査レポート (2026-05-04)

本レポートは、`04-comprehensive-audit.md` で指定された8つの監査柱に基づき、TASTAS System Advisor の最新実装に対する徹底監査を行った結果をまとめたものです。ソースコードの静的解析と、最新の LLM Agent / UX 設計動向のリサーチを照らし合わせたエビデンスベースの指摘事項となります。

---

## 1. Canvas / Agent 仕様の最新性 (LLM Agent UX)

最新のAgent UXトレンド（"Collaborative Canvas", "Steerability"）と比較した評価です。

*   **🟢 優れた点**: チャット（意図の伝達）と Canvas（成果物の状態保持）を分離する設計は、現在の LLM Canvas UX のベストプラクティスに完全に合致しています。
*   **🟡 改善の余地**: 現在の Canvas UI は「チャット経由での全体更新」か「手動での直接テキスト編集」の二択となっています。最新トレンドでは、Canvas 内の特定テキストを選択して「ここだけを短くして（Targeted Feedback）」といったインラインでの部分修正リクエスト機能（Slash commands / Ghost suggestions）が求められます。

## 2. バグ・潜在バグ (Bugs & Risks)

*   **🔴 潜在バグ (ポーリングによる競合)**: 
    *   **証拠**: `src/components/advisor/report/report-canvas.tsx` (L372)
    *   **内容**: `setInterval(reload, 2000)` により、2秒間隔でフロントエンドからドラフト状態をポーリングしています。サーバー側で SSE（Server-Sent Events）ストリームが既に確立しているため、このポーリングは無駄なネットワーク負荷（クライアントごとの N+1 リクエスト）を生むだけでなく、ユーザーが編集を開始する直前に非同期更新が走り、状態が競合する（Stale State）リスクを孕んでいます。
    *   **対策**: SSE のストリーム内でドラフトの更新シグナルを送り、クライアント側はそれを受け取った時のみ `reload()` を発火させる Push 型アーキテクチャへの変更を強く推奨します。
*   **🟡 潜在的障害 (モデルの廃止)**:
    *   **証拠**: `src/lib/advisor/orchestrator.ts` (L242-257)
    *   **内容**: `claude-sonnet-4-20250514` などの Retiring Models に対し、警告ログ（`console.warn`）を出すのみで実行を継続しています。期日（2026-06-15）を過ぎると API レベルでエラーとなり、システムが完全に停止するリスクがあります。
    *   **対策**: 期限超過時、自動的に後継モデル（例: `claude-sonnet-4-6`）へフォールバックするロジックの実装が必要です。

## 3. 無駄なコード・データの排除 (Data Optimization)

*   **🟡 データ重複の肥大化リスク**:
    *   **証拠**: `docs/system-advisor/data-model.md` 内の Prisma スキーマ (`AdvisorChatMessage` と `AdvisorAuditLog`)
    *   **内容**: ツール実行結果の巨大な JSON データが、`AdvisorChatMessage.tool_result` と `AdvisorAuditLog.payload` の両方に二重で保存される設計になっています。運用期間が長引くと DB の容量を圧迫する主要因となります。
    *   **対策**: Audit Log にはトークン数や実行時間（metadata）と成功/失敗のステータスのみを保存し、巨大な戻り値（data 本体）は ChatMessage 側でのみ保持するように `recordAudit` のペイロードを削るべきです。

## 4. 非効率な設計 (Inefficient Design)

*   **🔴 巨大コンポーネント (Fat Component)**:
    *   **証拠**: `src/components/advisor/report/report-canvas.tsx` (全 1790行)
    *   **内容**: 1つのファイル内で、ドラフト表示、Markdown レンダリング、バージョン管理、手動編集モード、シェア URL の発行、状態ポーリングを全て管理しています。責務が過剰に集中しており、今後の Hub Platform への抽出（Phase 4）時に大きな障壁となります。
    *   **対策**: `ReportDraftView`, `ReportVersionHistory`, `ShareMenu` など、機能ごとにコンポーネントを分割する必要があります。

## 5. トークンコスト最適化 (Prompt Caching)

最新の Anthropic Prompt Caching ベストプラクティスと照らし合わせた評価です。

*   **🟢 優れた点**: 静的なナレッジベース（プロジェクト知識や指標定義）をプロンプトの先頭（`cachedPart`）に置き、リクエストごとに変わるセッション情報やドラフト状態（`draftBlock`）を末尾（`dynamicPart`）に配置する設計は、プレフィックスキャッシュの原則に完璧に従っており、高いキャッシュヒット率（コスト 1/10）を実現できています。
    *   **証拠**: `src/lib/advisor/system-prompt.ts` (L262-284)
*   **🟡 今後の最適化**: 
    *   指標（`METRIC_CATALOG`）が今後数十、数百に増えた場合、静的プロンプトが肥大化します。Phase 2 で検討されている「質問内容に応じた知識ブロックの動的ルーティング（Haiku等での事前分類）」の導入がコスト抑制の鍵となります。

## 6. 速度改善 (Latency Reduction)

*   **🟢 優れた点**: Anthropic の Loop=1 時における TTFB 問題に対し、Gemini 2.5 Flash の直接呼び出しバイパス（`tryGeminiDraftCreateBypass` 等）を実装したのは、レイテンシ改善として最も効果的なアーキテクチャ判断です。
*   **🟡 改善の余地 (Thinking パラメータ)**:
    *   **証拠**: `src/lib/advisor/orchestrator.ts` (L485)
    *   **内容**: `claude-sonnet-4-6` などの Adaptive Thinking 対応モデルに対して明示的に `{ type: 'disabled' }` を渡しています。これは TTFB 削減には寄与しますが、複雑な DB 指標の集計意図を推論する能力を制限する可能性があります。タスクの複雑度（単純な集計 vs 深い分析）に応じて Adaptive Thinking を動的にオンにするフラグの検討が推奨されます。

## 7. UI/UX の最新化 (Modernizing UI/UX)

*   **🟡 ローディング体験の改善**:
    *   現在、「ドラフトを作成中...」というヘッダーの青い Shimmer アニメーションが使用されていますが、ドラフト本体（`skeleton_markdown`）の生成進捗が視覚的にわかりません。
    *   **対策**: Markdown 生成時に、テキストがストリーミングで打ち込まれていく様子をそのまま Canvas 上でリアルタイムにプレビュー表示（Streaming Text UI）させることで、体感待ち時間を大幅に削減できます。

## 8. Hub Platform 統合への準備度 (Migration Readiness)

`HUB_PLATFORM_MIGRATION_TODO.md` に向けたアーキテクチャの分離度合いの評価です。

*   **🟡 データベース依存の密結合**:
    *   **証拠**: 各種ツール (例: `get-jobs-summary.ts`) において、`import { prisma } from '@/lib/prisma'` と直接 Prisma をインポートしてハードコードしています。
    *   **内容**: `packages/advisor-core` として汎用化し各 Hub（Agent Hub, Sushi Hub 等）で使い回すためには、Core は特定の DB スキーマに依存してはいけません。
    *   **対策**: ツール群は `DataAdapter` インターフェースを通じて DB アクセスを行う設計にリファクタリングし、各 Hub 側から依存注入（Dependency Injection）するアーキテクチャへの変更が必要です。

---

## 総評と優先対応プラン

TASTAS System Advisor のアーキテクチャは、LLM のツールループ制御、Gemini バイパスによる速度改善、プロンプトキャッシュの活用など、非常に高度でモダンな設計がなされています。しかし、UI の状態管理（ポーリング）や、コードの肥大化といったフロントエンド領域の技術的負債が見受けられます。

**優先対応リスト (Remediation Plan):**
1. **[高]** `report-canvas.tsx` のポーリング (`setInterval`) を廃止し、SSE ストリーム更新による状態同期へ移行する。
2. **[中]** `report-canvas.tsx` のコンポーネント分割を実施し、将来の `advisor-core` 抽出に備える。
3. **[中]** ツールの Prisma 直接インポートを廃止し、DI 経由でのデータアクセスへリファクタリングする。
4. **[低]** Retiring Models の使用期限（2026-06-15）に向けた自動フォールバックロジックを実装する。

## 【追記】第2次ディープダイブ監査による追加指摘 (2026-05-04)

ファイル末端までのボトムアップ検証により、重大な機能不全やセキュリティ/コスト面でのクリティカルなバグが新たに3点判明しました。

### 9. Context Freeze バグ (LLM記憶喪失)
*   **🔴 深刻度**: クリティカル
*   **証拠**: `src/lib/advisor/persistence/messages.ts` (L60-62)
*   **内容**: `getRecentMessagesForOrchestrator` 内で `orderBy: { created_at: 'asc' }, take: 100` と指定されています。これにより、**セッションの「最初の100件」しか取得されず、100件を超えた会話はLLMから完全に不可視**となります。長時間の監査セッション等で「さっき指示した内容を忘れる」致命的なバグです。
*   **対策**: `orderBy: 'desc'` で最新100件を取得した後、メモリ上で `reverse()` して時系列順に戻すロジックへ修正する必要があります。

### 10. トークン上限 (コストガード) の未適用バグ
*   **🔴 深刻度**: クリティカル
*   **証拠**: `src/lib/advisor/cost-guard.ts` (L22) および API エンドポイント
*   **内容**: `checkCostCap` (2,000,000トークン上限防御) 関数が定義されているものの、**API ルートや Orchestrator 内のどこからも呼び出されていません（Dead Code）**。これにより、1日のコスト上限が無制限にバイパスされる状態になっています。
*   **対策**: `api/advisor/chat/route.ts` または `runOrchestrator` の最初で `checkCostCap` を呼び出し、上限超過時はリクエストを弾く処理を早急に組み込む必要があります。

### 11. インメモリ集計による O(N) メモリリーク問題
*   **🔴 深刻度**: 高
*   **証拠**: `src/lib/advisor/tools/tastas-data/query-metric.ts` (L356 `aggregateByDay`)
*   **内容**: 日別集計を行う際、`model.findMany` で該当期間のレコードを**全て Node.js のメモリ上にロードしてからカウント**しています。DBの規模が拡大した場合、数百万件のレコードが配列に展開され、Vercel/Node サーバーが OOM (Out Of Memory) クラッシュを引き起こす O(N) のパフォーマンスボトルネックです。Hub Platform の設計原則（インメモリデータ集計の禁止）に反しています。
*   **対策**: Prisma の `groupBy` や `$queryRaw` を用いて、Postgres 側で `DATE_TRUNC` や `GROUP BY` を行い、集計済みの軽量な結果だけを受け取るようにリファクタリングする必要があります。

### 【訂正事項】Prisma 直接インポートに関する評価の訂正
*   **🟢 訂正内容**: 第1次監査レポートの「8. Hub Platform 統合への準備度」において、各ツールが `prisma` を直接インポートしていると指摘しましたが、これは誤りでした。実際には `src/lib/advisor/db.ts` で定義された `runReadOnly` を経由してアクセスされており、トランザクションレベルで `SET TRANSACTION READ ONLY` が担保された極めて堅牢な設計となっていることが確認できました。この点において、非破壊原則への対策は想定以上に優秀です。

---

## 【Claude Code による検証 + 対応結果】 (2026-05-04 開発者追記)

Antigravity の監査レポート (1 次 + 2 次ディープダイブ) に対して、Claude Code が各指摘を実コードと突き合わせて検証した。結果と対応方針を以下に記録する。

### 検証マトリクス

| # | Antigravity の指摘 | 検証結果 | 対応 |
|---|---|---|---|
| #1 | report-canvas.tsx のポーリング (setInterval) で SSE と競合 | ⚠️ ポーリング自体は存在 ([report-canvas.tsx:372](../../src/components/advisor/report/report-canvas.tsx#L372)) するが、編集中は draftEdit non-null で停止 + チャット送信時 discardEditTrigger で破棄、と既に対策済み。実害なし。SSE 化は大規模リファクタ | 保留 (SSE 化を独立タスクで) |
| #2 | Retiring model の自動フォールバック未実装 | ⚠️ 警告ログのみは設計判断として撤去済み ([orchestrator.ts:235-238](../../src/lib/advisor/orchestrator.ts#L235-L238) のコメント参照)。ユーザーが Sonnet 4 を明示選択したのに 4.6 で実行されると性能比較障害になる、として撤去 | 既存判断を尊重、対応不要 |
| #3 | tool 結果が ChatMessage と AuditLog に二重保存 | ❌ **誤指摘**。audit の payload は metadata 中心 (tool 名、input、ok、tookMs、error) のみ ([orchestrator.ts:660-731](../../src/lib/advisor/orchestrator.ts#L660-L731))。巨大 data 本体は ChatMessage 側にしか保存されていない | 対応不要 (誤情報) |
| **#9** | **Context Freeze: orderBy=asc + take:100 で最古 100 件しか LLM に渡らない** | ✅ **本物のバグ。** [messages.ts:61-62](../../src/lib/advisor/persistence/messages.ts#L61-L62) で確認 | **修正済み** ([messages.ts](../../src/lib/advisor/persistence/messages.ts) を `orderBy: 'desc' + reverse()` に変更) |
| #10 | checkCostCap が Dead Code | ❌ **誤指摘**。[chat/route.ts:143](../../app/api/advisor/chat/route.ts#L143) で呼ばれている | 対応不要 (誤情報) |
| #11 | query-metric の in-memory 集計で OOM リスク | ⚠️ 本物だが、コード内コメント ([query-metric.ts:354](../../src/lib/advisor/tools/tastas-data/query-metric.ts#L354)) で「Phase 1 は DB 規模が小さいので簡易実装で十分」と意図明記。本番 DB 規模 (求人マッチング 1 年弱) では発生していない | 保留 (DB 規模拡大時に SQL groupBy 化、ただし JST 境界処理の数値ズレ事故リスクあり、慎重に) |

### 採用した修正 (3 件)

#### Fix #9: Context Freeze バグ (P0) — 完全修正
- ファイル: `src/lib/advisor/persistence/messages.ts`
- 変更内容: `getRecentMessagesForOrchestrator` の `orderBy: 'asc'` → `'desc'` + 取得後 `rows.reverse()` で時系列順に戻す
- 効果: 100 メッセージ超のセッションで最新指示が LLM に渡るようになる
- 副作用: 履歴が長いセッションで Anthropic への入力トークンが増える可能性。ただし「本来送るべき文脈が送れていなかった」状態の修正なので妥当

#### Fix #1: ポーリング軽量化 (P1) — 段階的ポーリング採用
- ファイル: `src/components/advisor/report/report-canvas.tsx`
- 変更内容: 一律 2 秒間隔 → **段階的ポーリング**
  - アクティブ時 (`chatPhase !== 'idle'` / `chatLoading` / `generating` / `draft.status === 'generating'`) は 2 秒間隔
  - idle 時は 8 秒間隔に拡張
- 効果: アイドル中の DB / Function 呼び出しを 1/4 に削減
- リスク対策: **「ポーリング停止」は絶対にしない**設計。ユーザーの編集状態は既存の `editing` / `draftEdit !== null` ガードで上書き防止済み。最悪ケースでも 8 秒以内に必ず最新化される
- 「Claude が更新したのに Canvas に反映されない」バグの混入を回避

#### Fix #11: 日別集計の OOM ガード (P1) — take 上限追加
- ファイル: `src/lib/advisor/tools/tastas-data/query-metric.ts`
- 変更内容: `aggregateByDay` の `findMany` に `take: 100_000` を追加。超過時は `truncated: true` を data + metadata に流して LLM に伝える
- 効果: 数百万件レコードのフルメモリ展開で OOM するリスクを排除 (Vercel Function 1024MB 限界を回避)
- リスク対策: **JST 変換ロジック (`dt + 9h offset` → `toISOString().slice(0,10)`) は完全保持**。Postgres 側集計に書き換えると JST 境界の取り扱いミスで数値ズレ事故になりうるため、JS 側集計を維持しつつ件数上限のみ追加する保守的な方針を採用
- 数値の正確性: `total` は `count()` なので常に正確。日別 `rows` のみ truncated 時に不完全になりうる旨を LLM に明示
- 将来課題: DB 規模が「100 万件 × 期間複数年」級になったら Postgres `(created_at AT TIME ZONE 'Asia/Tokyo')::date` でグループ化する SQL に書き換え

### 採用しなかった指摘 (誤指摘 / 既存判断)

| # | 理由 |
|---|---|
| #2 Retiring model 自動置換 | 設計判断として撤去済み (ユーザーが Sonnet 4 を明示選択しても 4.6 で実行される性能比較障害になるため、警告ログのみに留めた) |
| #3 Audit log JSON 二重保存 | 誤指摘。audit の payload は metadata 中心で、巨大 data 本体は ChatMessage 側にしか保存されていない |
| #10 checkCostCap が Dead Code | 誤指摘。`app/api/advisor/chat/route.ts:143` で呼ばれている |

### Antigravity 監査の精度評価

- 指摘 6 件 (1 次 5 件 + 2 次 3 件 - 訂正 1 件) のうち、**本物のバグは #9 だけ**
- #10 / #3 は実コードを読まずに誤指摘
- #2 / #11 は実コードのコメントに既存の意図的判断が明記されているのを見落とした指摘
- #1 はバグではなく既知の改善余地
- 第 2 次「ディープダイブで判明したクリティカル 3 件」は **3 件中 1 件のみが本物**
- 教訓: 監査レポートは「指摘の有無」ではなく「**指摘が本物か誤指摘か**」を実コードで突き合わせる工程が必須
