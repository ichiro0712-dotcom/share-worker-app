# System Advisor ツール (Function Calling) 仕様書

**最終更新**: 2026-05-17 — execute_sql / get_table / add_tables_to_report 追加で 22 ツールに更新
**正本**: `src/lib/advisor/tools/registry.ts` + 各 `tools/<category>/<tool>.ts`
> 個別ツールの細かい入出力に齟齬が出たら **コードを正**とすること。
> 本ドキュメントは「**ツールの全体像 + 拡張ガイド + 設計原則**」を記録する。

---

## 1. 設計原則

### 1.1 すべて読み取り専用
- 書き込み・削除・実行系ツールは **作らない**
- DB は SELECT のみ。Prisma 経由で `create/update/delete/upsert` を呼ぶ "業務" ツールは登場しない
- 例外: **Advisor 自身のテーブル** (`AdvisorReportDraft` / `AdvisorReportVersion`) への upsert は許容
  - `update_report_draft` / `edit_report_section` がこれにあたる
  - 業務 DB ではなく Advisor 領域なので「副作用安全」の境界内
- ファイルシステムへの書き込みなし、外部 API への状態変更なし

### 1.2 拡張可能性
- ツール 1 つ = 1 ファイル (`src/lib/advisor/tools/<category>/<tool-name>.ts`)
- レジストリへの登録は `<category>/index.ts` に 1 行 + import 追加のみ
- 後付け (Lstep, LINE, Search Console, 自前ログ) も同じ手順

### 1.3 ハルシネーション抑制
- 大量のフリーフォーマット出力ではなく、**構造化された結果**を返す
- 「取れない」場合は `available()` で事前に明示し、LLM に正しい説明をさせる
- SQL は LLM に書かせない。事前定義した「メトリクス」を選ばせる

### 1.4 廃止された設計判断
- ❌ **`list_available_metrics`** (廃止): system prompt に METRIC_CATALOG を静的埋め込みすることで Claude のツール round-trip を 1 回減らす方針に変更
- ❌ **`get_report_draft`** (廃止): dynamic system prompt にドラフト全体を毎回埋め込むため、Claude が往復で取得する必要がない → loop=1 の TTFB 100 秒問題回避

---

## 2. 共通インターフェース

### 2.1 `AdvisorTool` 型 (`src/lib/advisor/tools/types.ts`)

```ts
export type ToolCategory = 'core' | 'tastas-data' | 'external' | 'future' | 'reports';

export interface AdvisorTool<TInput = unknown, TOutput = unknown> {
  /** Anthropic に渡すツール名 (snake_case) */
  name: string;
  /** LLM がツール選択判断に使う説明文 (重要) */
  description: string;
  category: ToolCategory;
  /** Anthropic Tool Use の input_schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** 結果の構造説明 (LLM 向け補助、optional) */
  outputDescription?: string;
  /** ツール利用可否を動的に判定。description に含めて LLM に伝える */
  available?: () => Promise<{ ready: boolean; reason?: string; plannedFrom?: string }>;
  /** 実行関数。エラーは throw せず、結果オブジェクトで返す */
  execute: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
}

export interface ToolContext {
  adminId: number;
  sessionId: string;
  abortSignal?: AbortSignal;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T; metadata?: { tookMs: number; truncated?: boolean; rowCount?: number } }
  | { ok: false; error: string; userActionable?: string };
```

### 2.2 レジストリ (`src/lib/advisor/tools/registry.ts`)

```ts
const allTools: AdvisorTool[] = [
  ...coreTools,        // 5 個
  ...tastasDataTools,  // 5 個
  ...externalTools,    // 5 個
  ...futureTools,      // 2 個 (placeholder)
  ...reportTools,      // 2 個
];
// 合計 19 個 (2026-05-04 時点)

export async function describeAllToolsForLLM() {
  // available() を解決して description にステータス情報を埋める
  // LLM が「未実装ツールを呼ばない」判断ができるようにする
}
```

---

## 3. 現状のツール一覧 (22 個)

> **データソースの統一日本語ラベル**は KNOWLEDGE.md §5 を参照。
> UI / プロンプト / 出典注釈すべてで同じラベルを使う。

### 3.1 Core (汎用・読み取り専用、5 個)

| ツール名 | 役割 | 主実装 |
|---|---|---|
| `read_repo_file` | リポジトリの任意ファイル内容を読む (キャッシュ優先 → GitHub API) | `tools/core/read-repo-file.ts` |
| `search_codebase` | コードベース検索 (パターンマッチ) | `tools/core/search-codebase.ts` |
| `read_doc` | 既知ドキュメント (CLAUDE.md / docs/) をキー指定で読む | `tools/core/read-doc.ts` |
| `get_recent_commits` | 最近のコミット履歴 (タイトル + 著者 + 日付) | `tools/core/get-recent-commits.ts` |
| `list_directory` | リポジトリ内のディレクトリ構造 | `tools/core/list-directory.ts` |

**セキュリティ**: `read_repo_file` は `node_modules` / `.env*` / `.git/` / 巨大バイナリを拒否リスト。

### 3.2 TASTAS Data (本番 DB 読み取り、7 個)

すべて `advisorDataPrisma` (READ ONLY tx + advisor_readonly ロール) 経由。

| ツール名 | 役割 |
|---|---|
| `query_metric` | 事前定義された METRIC_CATALOG のメトリクスを期間 / group_by 指定で取得 (現在 89 指標が available) |
| `get_jobs_summary` | 求人の状態別件数サマリ |
| `get_users_summary` | ユーザー種別別の件数 (本登録判定基準は SMS 認証) |
| `get_recent_errors` | SystemLog テーブルから最近のエラー |
| `describe_db_table` | 指定テーブルの構造 (Prisma schema 由来、KnowledgeCache 経由) |
| **`execute_sql`** | 読み取り専用の SELECT 文を実行して表として返す (2026-05-16 追加) |
| **`get_table`** | 過去に execute_sql で生成された表 (T-XXX) を ID で取り出す (2026-05-16 追加) |

`query_metric` の `metric_key` は **system prompt に静的埋め込みされた METRIC_CATALOG** から LLM が選ぶ。
`group_by` は metric ごとの `supportedGroupBy` のみ受け付ける (`none` / `day` / `lp_id` / `campaign_code`)。

**METRIC_CATALOG の構成 (2026-05-17 時点、89 個 available + 3 個 future)**:
- ワーカー系 (8): TOTAL_WORKERS / NEW_WORKERS / WITHDRAWN_WORKERS / WITHDRAWAL_RATE / CANCEL_RATE / LAST_MINUTE_CANCEL_RATE / WORKER_REVIEW_COUNT / WORKER_REVIEW_AVG
- 施設系 (5): TOTAL_FACILITIES / NEW_FACILITIES / WITHDRAWN_FACILITIES / FACILITY_WITHDRAWAL_RATE / FACILITY_REVIEW_COUNT / FACILITY_REVIEW_AVG
- 求人・マッチング系 (10): TOTAL_JOBS / ACTIVE_JOBS / CHILD_JOB_COUNT / TOTAL_SLOTS / REMAINING_SLOTS / LIMITED_JOB_COUNT / OFFER_JOB_COUNT / OFFER_ACCEPTANCE_RATE / MATCHING_COUNT / AVG_MATCHING_HOURS / NEW_APPLICATIONS
- LP・登録動線系 (12): LP_PV / LP_REGISTRATIONS / LP_TO_LINE_CONV / LP_TO_REGISTER_CONV / LP_SESSIONS / LP_EVENTS / LP_EVENT_CTR / LP_REGISTRATION_RATE / PUBLIC_JOB_PV / JOB_SEARCH_PV / APPLICATION_CLICK / REGISTRATION_PAGE_PV / REGISTRATION_PAGE_UU
- Funnel 系 (9): FUNNEL_REGISTERED / FUNNEL_VERIFIED / FUNNEL_SEARCH_REACHED / FUNNEL_JOB_VIEWED / FUNNEL_BOOKMARKED / FUNNEL_APPLIED / OVERALL_CONVERSION_RATE / FUNNEL_JOB_VIEWED_PV / FUNNEL_SEARCH_PV
- 応募派生系 (8): APPLICATION_CLICK_UU / APPLICATION_DAYS / APPLICATION_CONVERSION_RATE / APPLICATIONS_PER_WORKER / AVG_APPLICATION_DAYS / AVG_APPLICATION_MATCHING_HOURS / AVG_REGISTRATION_TO_APPLICATION_DAYS / AVG_JOB_MATCHING_HOURS
- 登録→認証時間 (1): AVG_REGISTRATION_TO_VERIFY_HOURS
- 求人詳細 (6): JOB_DETAIL_PV / JOB_DETAIL_USERS / JOB_DETAIL_APPLICATION_COUNT / JOB_DETAIL_APPLICATION_USERS / JOB_DETAIL_APPLICATION_RATE / JOB_DETAIL_AVG_APPLICATION_DAYS
- 求人構造 (5): PARENT_JOB_COUNT / PARENT_JOB_INTERVIEW_COUNT / PARENT_JOBS_PER_FACILITY / CHILD_JOB_INTERVIEW_COUNT / CHILD_JOBS_PER_FACILITY
- 単位指標 (4): MATCHINGS_PER_WORKER / MATCHINGS_PER_FACILITY / REVIEWS_PER_WORKER / REVIEWS_PER_FACILITY
- LP帰属 (5): PARENT_JOB_PV / PARENT_JOB_SESSIONS / LP_APPLICATION_COUNT / LP_JOB_DETAIL_PV / LP_AVG_DWELL_TIME
- 限定/離脱/低評価 (3): LIMITED_JOB_APPLICATION_RATE / CONSECUTIVE_LOW_RATING_WORKER_COUNT / WORKER_DROPOUT_RATE
- Attendance (3): ATTENDANCE_CHECK_RATE / ATTENDANCE_COMPLETION_RATE / EARLY_CHECKOUT_RATE
- Bookmark/Message/Review分布 (4): BOOKMARK_REMOVAL_RATE / MESSAGE_RESPONSE_TIME_AVG / FACILITY_RATING_DISTRIBUTION / WORKER_RATING_DISTRIBUTION
- Repeat/LaborDoc (3): REPEAT_WORKER_RATE / AVG_ATTENDANCE_HOURLY_WAGE / LABOR_DOC_SUBMISSION_RATE
- 取得不可 (3): LINE_FRIEND_ADDS / SEARCH_QUERY_ENTRIES / LSTEP_DELIVERIES

#### `execute_sql` の要点

- 入力: `{ sql: string, purpose: string, expected_rows?: number }`
- 多層防御: SELECT/WITH 文限定 / 危険キーワード拒否 / 複文禁止 / センシティブカラム (users.email, password 等) ブロック / `LIMIT` 自動付与 / `statement_timeout=10s` / READ ONLY tx
- 成功時の結果は `advisor_chat_tables` に **T-XXX 形式の連番表 ID** を採番して保存 (UI に Markdown 表 + 共有メニューで表示)
- 監査ログを `advisor_sql_audit_logs` に記録
- **ユーザー承認ゲート**: `sqlAutoApprove=false` のセッションでは SQL モーダルで承認が必要。承認後 `sqlAutoApprove=true` のセッションフラグで以降は自動承認
- 短絡: 成功時は loop=1 (Claude 整形応答) をスキップし、サーバー側固定文 `**表 T-XXX** (N 行) を取得しました...` で即 done。loop=1 TTFB 100 秒問題回避

#### `get_table` の要点

- 入力: `{ table_ids: string[], max_rows?: number }`
- 別セッションの表でも、自分が adminId として作ったものは取得可能
- 共有 URL 経由ではなく LLM が再参照する用途 (「T-001 の合計を出して」のような後追い質問)

### 3.3 External (外部 API、5 個)

| ツール名 | 役割 | available() 必要環境変数 |
|---|---|---|
| `query_ga4` | GA4 Data API (6 種: overview / traffic / pages / lpPerformance / comparison / **pageTraffic**) | `GA_CREDENTIALS_JSON` |
| `query_search_console` | Search Console API (4 種 dimensions: query / page / device / country) | `GA_CREDENTIALS_JSON` + `SEARCH_CONSOLE_SITE_URL` |
| `get_supabase_logs` | Supabase Management API (postgres / api / auth) | `SUPABASE_MANAGEMENT_TOKEN` + `SUPABASE_PROJECT_REF` |
| `get_vercel_logs` | Vercel Runtime Logs (error / warning / info) | `VERCEL_API_TOKEN` (+ `VERCEL_PROJECT_ID`) |
| `get_vercel_deployments` | 最近のデプロイ一覧 (production / preview) | 同上 |

**注記**: `query_search_console` は内部で `google.auth.GoogleAuth` を使う (旧版の `google.auth.JWT + keyFile` は `invalid_grant` 不具合があり、2026-05-16 に書き換え済み)。
**注記**: `query_ga4(pageTraffic)` は「ページ × 流入元」のクロス集計。`page_path_prefix` / `page_path_contains` で対象ページを絞れる (例: `/lp/30`)。

**`available()` で description にステータス埋め込み**:
環境変数未設定なら「⚠️ 現在利用不可: SUPABASE_MANAGEMENT_TOKEN 未設定」のように LLM に伝わるため、無駄な呼び出しを抑制。

### 3.4 Future (placeholder、2 個)

実装は未だ無く、`available()` で `{ ready: false, reason, plannedFrom }` を返すスタブ。
LLM に「どうすれば実装されるか」を構造的に伝えるために登録している。

| ツール名 | 必要な事前作業 |
|---|---|
| `query_lstep_events` | `/api/lstep/webhook` 実装 + `LstepEvent` テーブル追加 |
| `query_line_friends` | `/api/line/webhook` 実装 + `LineFriendEvent` テーブル追加 |

### 3.5 Reports (Canvas + レポート機能、3 個)

これらは Anthropic Tool Use ループから呼ばれる「**Advisor 自身のテーブルへの書き込み**」が許容された例外的ツール。
**ただし重い処理 (初回 / 修正) は Anthropic ではなく Gemini 直叩き経路 (`[TOOL:report_create|draft_revise|result_edit]`) で処理される** ので、これらツールが実際に Anthropic ループから呼ばれる頻度は限定的。

#### `add_tables_to_report` (2026-05-16 追加、category: core)

- **役割**: チャットで生成された表 (T-XXX) を、現在のセッションのレポートドラフトに章として追記する
- **入力 schema**:
  ```json
  {
    "table_ids": ["T-001", "T-003"],
    "section_titles": ["LP別PV", "..."],   // optional
    "intro": "(導入文)"                     // optional
  }
  ```
- **出力**: `{ ok, draft_id, added_tables: string[], not_found: string[], invalid_ids: string[] }`
- **副作用**:
  - 既存ドラフトが無ければ新規作成、あれば末尾追記
  - `dataSources` に擬似 toolKey `chat_table` を追加 (これで「レポート作成」ボタンが押せる状態になる。`collectReportData` は `chat_table` を skip 扱い)
- **短絡**: 成功時は loop=1 をスキップし、サーバー側固定文で即 done (execute_sql 同様)
- **連携**: チャット UI の「[📋 レポートに送る]」ボタンが隠しメッセージで本ツールを呼ぶ。Canvas が自動オープン

#### `update_report_draft`

- **役割**: AdvisorReportDraft の要件 + skeleton_markdown を一括 upsert
- **入力 schema**:
  ```json
  {
    "title": "string",
    "goal": "string",
    "data_sources": ["query_metric", "query_ga4", ...],
    "metric_keys": ["LP_PV", "LP_TO_LINE_CONV", ...],
    "range_start": "YYYY-MM-DD (JST)",
    "range_end": "YYYY-MM-DD (JST)",
    "outline": "Markdown 章立て (3-6 行)",
    "notes": "追加メモ (短く)",
    "skeleton_markdown": "Markdown 表骨格 + 章立て (0 埋め)"
  }
  ```
- **出力**: `{ ok, draft_id, session_id, fields_updated: string[] }`
- **副作用**: 初回 update 時のみ `original_request` をサーバー側で自動保存 (差分修正の文脈維持用)
- **詳細**: `tools/reports/update-report-draft.ts` + [REPORT_FEATURE.md](./REPORT_FEATURE.md) §3

#### `edit_report_section`

- **役割**: 生成済みレポート本文 (AdvisorReportVersion.result_markdown) を Gemini で部分修正し、新バージョンを作成
- **入力 schema**:
  ```json
  {
    "instruction": "修正指示 (例: '3 章のグラフ説明を簡潔に')",
    "target_section": "対象見出し (省略可、明確な時のみ)"
  }
  ```
- **出力**: `{ ok, draft_id, new_version_id, new_version_number, parent_version_id, applied_instruction }`
- **available()**: `GEMINI_API_KEY` 必須
- **所要**: 10〜30 秒 (全文再生成方式)

---

## 4. ツール実装テンプレート

```ts
// src/lib/advisor/tools/tastas-data/get-jobs-summary.ts
import { advisorDataPrisma, runReadOnly } from '@/src/lib/advisor/db';
import type { AdvisorTool } from '../types';

export const getJobsSummaryTool: AdvisorTool = {
  name: 'get_jobs_summary',
  category: 'tastas-data',
  description:
    'TASTAS の求人 (Job) の状態別件数を取得します。' +
    '質問に「求人数」「アクティブな求人」が含まれる場合に使用。',
  inputSchema: {
    type: 'object',
    properties: {
      status_filter: {
        type: 'array',
        items: { type: 'string', enum: ['active', 'draft', 'suspended', 'closed'] },
      },
      facility_id: { type: 'string' },
    },
  },
  outputDescription: 'counts は status をキーにした件数オブジェクト',
  async execute(input, ctx) {
    const start = Date.now();
    try {
      return await runReadOnly(async () => {
        const where: any = {};
        if (input.status_filter?.length) where.status = { in: input.status_filter };
        if (input.facility_id) where.facility_id = input.facility_id;

        const grouped = await advisorDataPrisma.job.groupBy({
          by: ['status'],
          where,
          _count: true,
        });

        const counts = Object.fromEntries(grouped.map(g => [g.status, g._count]));
        const total = grouped.reduce((s, g) => s + g._count, 0);

        return {
          ok: true,
          data: { counts, total },
          metadata: { tookMs: Date.now() - start, rowCount: grouped.length },
        };
      });
    } catch (err: any) {
      return { ok: false, error: `求人サマリ取得に失敗: ${err.message}` };
    }
  },
};
```

---

## 5. ツール呼び出しの安全装置

| 装置 | 実装場所 | 内容 |
|---|---|---|
| 入力 schema 検証 | orchestrator | Anthropic から来た input を JSON Schema で検証 |
| READ ONLY tx | `db.ts` の `runReadOnly()` | TASTAS Data 系全てが本番 DB を `SET TRANSACTION READ ONLY` でラップ |
| Postgres ロール | `advisor_readonly` | SELECT 権限のみ。INSERT/UPDATE/DELETE/TRUNCATE 剥奪済み (二重防御) |
| タイムアウト | tool execute 内 | デフォルト 10 秒、長くても 30 秒 |
| 行数キャップ | tool execute 内 | DB クエリ結果は最大 1000 行、超えたら `truncated: true` |
| 出力サイズキャップ | `reports/collect.ts` | レポート用は ツールあたり 50KB 切り詰め |
| トークン予算 | orchestrator | tool result を含む合計が 50K 超えたら警告 |

---

## 6. 拡張手順 (Lstep を後から追加する例)

```
Step 1: Lstep webhook 受信 API を実装 (/api/lstep/webhook)
Step 2: Prisma に LstepEvent テーブル追加 + db push (ローカル + ステージング/本番)
Step 3: src/lib/advisor/tools/external/query-lstep.ts 作成
        - inputSchema 定義
        - execute() で LstepEvent.findMany を SELECT (advisorDataPrisma 経由 + runReadOnly)
Step 4: src/lib/advisor/tools/external/index.ts に1行追加
        export { queryLstepTool } from './query-lstep'
        externalTools 配列に追加
Step 5: src/lib/advisor/tools/future/index.ts から query-lstep を削除
        (placeholder → 実装に格上げ)
Step 6: src/lib/advisor/tool-source-labels.ts に日本語ラベル追加
Step 7: METRIC_CATALOG に Lstep 系メトリクス追加 (query_metric から使う場合)
```

→ 工数 1〜2 日。チャット側 / Anthropic ツール定義 / orchestrator は一切変更不要。

---

## 7. ツール定義のテストポリシー

- **単体テスト**: 各 `execute()` を mock 入力で確認 (現状未整備)
- **統合テスト**: Anthropic への mock レスポンスでツール選択が正しいか確認 (現状未整備)
- **手動テスト**: ローカルで「現在公開中の求人は何件?」「先週の GA4 セッション数」など定型質問を流す ([user-checklist.md](./user-checklist.md))
- **整合性 CI**: `scripts/check-metrics-consistency.ts` で METRIC_CATALOG ↔ `query-metric.ts` の整合性チェック

---

## 8. ツールと Gemini バイパスの関係

Anthropic Tool Use ループから呼ばれる **`update_report_draft` / `edit_report_section`** は、
ユーザー入力先頭に hidden hint がある場合は **使われない** (Gemini 直叩きにバイパスされる)。

```
通常の Anthropic ツールループから呼ばれる頻度:
- update_report_draft: ★ 低い (大半が [TOOL:report_create|draft_revise] バイパス経由で Gemini が処理)
- edit_report_section: ★ 低い (大半が [TOOL:result_edit] バイパス経由で Gemini が処理)

それ以外 (Core / TASTAS Data / External): 通常通り Anthropic ループから呼ばれる
```

詳細は [architecture.md](./architecture.md) §3.2 と [REPORT_FEATURE.md](./REPORT_FEATURE.md) を参照。

---

## 9. 関連ドキュメント

- [architecture.md](./architecture.md) — システム構成 (ツールがどう呼ばれるか)
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能の詳細フロー
- [data-model.md](./data-model.md) — DB スキーマ (Advisor 自身のテーブル)
- [system-prompt.md](./system-prompt.md) — Anthropic 用システムプロンプト (METRIC_CATALOG 静的埋め込みの仕組み)
- [security-cost.md](./security-cost.md) — 二重防御 / コスト設計
- [KNOWLEDGE.md](./KNOWLEDGE.md) — 設計知見 (§5 ツールラベル統一表)
