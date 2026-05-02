# System Advisor ツール (Function Calling) 仕様書

## 1. 設計原則

### 1.1 すべて読み取り専用
- 書き込み・削除・実行系ツールは**1つも作らない**
- DB は SELECT のみ。Prisma 経由で `create/update/delete/upsert` を呼ぶコードは登場しない
- ファイルシステムへの書き込みなし、外部 API への状態変更なし

### 1.2 拡張可能性
- ツール1つ = 1ファイル (`src/lib/advisor/tools/<category>/<tool-name>.ts`)
- レジストリへの登録は import + 配列追加の1〜2行
- 後付け (Lstep, LINE, Search Console, 自前ログ) も同じ手順

### 1.3 ハルシネーション抑制
- 大量のフリーフォーマット出力ではなく、構造化された結果を返す
- 「取れない」場合は `available()` で事前に明示し、LLM に正しい説明をさせる
- SQL は LLM に書かせない。事前定義した「指標」を選ばせる

## 2. 共通インターフェース

### 2.1 AdvisorTool 型

```ts
// src/lib/advisor/tools/types.ts
import type { z } from 'zod'; // 必要なら zod 採用、なければ素の TS 型

export type ToolCategory = 'core' | 'tastas-data' | 'external' | 'future';

export interface AdvisorTool<TInput = unknown, TOutput = unknown> {
  /** Anthropic に渡すツール名 (snake_case 推奨) */
  name: string;
  /** LLM がツール選択判断に使う説明文。重要。 */
  description: string;
  /** 分類 (UI 表示・統計用) */
  category: ToolCategory;
  /** Anthropic Tool Use の input_schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** 結果の構造説明 (LLM 向け補助、optional) */
  outputDescription?: string;
  /** ツールの利用可否を動的に判定。description に含めて LLM に伝える */
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

### 2.2 レジストリ

```ts
// src/lib/advisor/tools/registry.ts
import { coreTools } from './core';
import { tastasDataTools } from './tastas-data';
import { externalTools } from './external';

const allTools: AdvisorTool[] = [
  ...coreTools,
  ...tastasDataTools,
  ...externalTools,
  // ── 将来追加 (1行ずつ) ──
  // ...lstepTools,
  // ...lineTools,
  // ...searchConsoleTools,
  // ...customLogTools,
];

export function getAvailableTools(): AdvisorTool[] {
  return allTools;
}

export function findTool(name: string): AdvisorTool | undefined {
  return allTools.find(t => t.name === name);
}

export async function describeAllToolsForLLM(): Promise<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}[]> {
  // available() を解決して description にステータス情報を埋める
  return Promise.all(
    allTools.map(async t => {
      let desc = t.description;
      if (t.available) {
        const status = await t.available();
        if (!status.ready) {
          desc += `\n\n⚠️ 現在利用不可: ${status.reason}` +
            (status.plannedFrom ? `\n対応予定: ${status.plannedFrom}` : '');
        }
      }
      if (t.outputDescription) {
        desc += `\n\n出力構造: ${t.outputDescription}`;
      }
      return { name: t.name, description: desc, input_schema: t.inputSchema };
    })
  );
}
```

## 3. Phase 1 で実装するツール一覧

### 3.1 Core ツール (汎用・読み取り専用)

#### `read_repo_file`
- **説明**: TASTAS リポジトリの任意のファイル内容を読む
- **実装**: `AdvisorKnowledgeCache` に該当があればキャッシュから、なければ GitHub API から取得
- **入力**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "リポジトリルートからの相対パス。例: src/lib/auth.ts" },
      "max_bytes": { "type": "integer", "default": 100000, "maximum": 500000 }
    },
    "required": ["path"]
  }
  ```
- **出力**: `{ path, content, byte_size, source: "cache"|"github", truncated }`
- **失敗時**: ファイル不在 / バイナリ / サイズ超過 → `userActionable` 付きエラー
- **セキュリティ**: `node_modules`, `.env*`, `.git/`, 巨大バイナリは拒否リスト

#### `search_codebase`
- **説明**: TASTAS コードベース内をパターン検索 (ripgrep ベース)
- **実装**: ローカルファイルシステム or GitHub Search API。MVP はサーバー側 ripgrep
- **入力**:
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "file_glob": { "type": "string", "default": "**/*" },
      "max_results": { "type": "integer", "default": 30, "maximum": 100 }
    },
    "required": ["query"]
  }
  ```
- **出力**: `{ matches: [{ path, line, snippet }], total_found, truncated }`
- **タイムアウト**: 5秒

#### `read_doc`
- **説明**: 既知のドキュメント (CLAUDE.md, docs/) をキー指定で読む
- **実装**: `AdvisorKnowledgeCache` 専用
- **入力**:
  ```json
  {
    "type": "object",
    "properties": {
      "doc_key": {
        "type": "string",
        "enum": ["claude_md", "requirements", "system_design", "screen_specification", "metric_definitions"]
      }
    },
    "required": ["doc_key"]
  }
  ```
- **出力**: `{ key, label, content, last_synced_at }`

#### `get_recent_commits`
- **説明**: 最近のコミット履歴 (タイトル + 著者 + 日付)
- **実装**: GitHub Commits API
- **入力**: `{ branch?: string="main", limit?: number=20 }`
- **出力**: `{ commits: [{ sha, message, author, date }] }`

#### `list_directory`
- **説明**: リポジトリ内のディレクトリ構造を取得
- **実装**: `AdvisorKnowledgeCache` のメタ情報 or GitHub Tree API
- **入力**: `{ path: string, depth?: number=1 }`
- **出力**: `{ path, items: [{ name, type, size? }] }`

### 3.2 TASTAS Data ツール (DB / メトリクス)

#### `list_available_metrics`
- **説明**: 利用可能な指標一覧と、各指標の状態 (取得可否)
- **実装**: `MetricDefinitions.tsx` の `METRIC_DEFINITIONS` を参照 + データソース可用性をマージ
- **入力**: `{ category?: string }` (例: "lp", "matching", "registration")
- **出力**:
  ```json
  {
    "metrics": [
      { "key": "LP_PV", "label": "LP閲覧数", "available": true, "calculation": "..." },
      { "key": "LINE_FRIEND_ADDS", "label": "LINE友だち追加数", "available": false, "reason": "LINE Webhook未実装", "plannedFrom": "Phase 1: LINE Webhook実装" }
    ]
  }
  ```

#### `query_metric`
- **説明**: 指定した指標を期間・LP別等で取得
- **実装**: 指標ごとに事前定義された SQL/Prisma クエリを実行
- **入力**:
  ```json
  {
    "type": "object",
    "properties": {
      "metric_key": { "type": "string", "description": "list_available_metrics で取得した key" },
      "start_date": { "type": "string", "format": "date", "description": "JST 日付 YYYY-MM-DD" },
      "end_date": { "type": "string", "format": "date" },
      "group_by": {
        "type": "string",
        "enum": ["none", "day", "lp_id", "campaign_code", "user_status"],
        "default": "none"
      },
      "filter": {
        "type": "object",
        "properties": {
          "lp_id": { "type": "string" },
          "campaign_code": { "type": "string" }
        }
      }
    },
    "required": ["metric_key", "start_date", "end_date"]
  }
  ```
- **出力**:
  ```json
  {
    "metric_key": "LP_PV",
    "period": { "start": "2026-04-24", "end": "2026-04-30" },
    "group_by": "lp_id",
    "rows": [{ "key": "1", "value": 1234 }, { "key": "3", "value": 567 }],
    "total": 1801
  }
  ```
- **JST 注意**: 日付フィルタは `getTodayJSTStart()` のヘルパーで境界を作る

#### `get_jobs_summary`
- **説明**: 求人の状態別件数サマリ
- **入力**: `{ status_filter?: string[], facility_id?: string }`
- **出力**: `{ counts: { active, draft, suspended, ... }, total }`

#### `get_users_summary`
- **説明**: ユーザー種別別の件数 (本登録判定基準は SMS 認証)
- **入力**: `{ verified_only?: boolean=true }`
- **出力**: `{ workers: number, facility_admins: number, system_admins: number }`

#### `get_recent_errors`
- **説明**: SystemLog テーブルから最近のエラーを取得
- **入力**: `{ severity?: string, limit?: number=20, since_hours?: number=24 }`
- **出力**: `{ errors: [{ timestamp, severity, source, message }] }`

#### `describe_db_table`
- **説明**: 指定テーブルの構造説明 (Prisma schema 由来)
- **実装**: `AdvisorKnowledgeCache` の `schema_prisma` から該当 model をパース
- **入力**: `{ table_name: string }`
- **出力**: `{ name, fields: [{ name, type, optional, default }], relations: [...] }`

### 3.3 External ツール (外部サービス)

#### `query_ga4`
- **説明**: GA4 のレポートデータを取得 (既存 `src/lib/ga-client.ts` を活用)
- **実装**: GA4 Data API
- **入力**:
  ```json
  {
    "type": "object",
    "properties": {
      "report_type": {
        "type": "string",
        "enum": ["overview", "traffic", "pages", "lpPerformance", "comparison"]
      },
      "start_date": { "type": "string" },
      "end_date": { "type": "string" },
      "dimensions": { "type": "array", "items": { "type": "string" } },
      "metrics": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["report_type", "start_date", "end_date"]
  }
  ```
- **出力**: `{ rows: [...], totals: {...} }`
- **available()**: 環境変数 `GA4_PROPERTY_ID` と認証情報の有無をチェック

#### `get_vercel_logs`
- **説明**: Vercel Runtime Logs を取得
- **実装**: Vercel REST API `/v2/deployments/{id}/events` または Log Drains 集約先 (将来)
- **入力**: `{ deployment_id?: string, since_minutes?: number=60, level?: string, limit?: number=100 }`
- **出力**: `{ logs: [{ timestamp, level, message, source }] }`
- **available()**: `VERCEL_API_TOKEN` の有無をチェック

#### `get_vercel_deployments`
- **説明**: 最近のデプロイ一覧と状態
- **入力**: `{ project_id?: string, limit?: number=10 }`
- **出力**: `{ deployments: [{ id, url, state, created_at, target }] }`

#### `get_supabase_logs`
- **説明**: Supabase Logs (postgres / api / auth) を取得
- **実装**: Supabase Management API
- **入力**: `{ source: "postgres"|"api"|"auth", since_minutes?: number=60, limit?: number=100 }`
- **出力**: `{ logs: [...] }`
- **available()**: `SUPABASE_MANAGEMENT_TOKEN` の有無をチェック

### 3.4 Future ツール (Phase 1 では `available: false` の placeholder)

これらは**スタブとしてレジストリに登録するが、実装は後付け**:

| ツール名 | 用途 | 必要な事前作業 |
|---------|------|--------------|
| `query_lstep_events` | Lstep のイベント検索 | `/api/lstep/webhook` 実装 + テーブル追加 |
| `query_line_friends` | LINE 友だち追加履歴 | `/api/line/webhook` 実装 + テーブル追加 |
| `query_search_console` | GSC 検索クエリ | GSC API 統合 |
| `query_custom_log` | 任意の自前ログ | テーブル + マッピング定義 |

これらは `available()` で `{ ready: false, reason: "...", plannedFrom: "..." }` を返し、LLM が呼ぼうとした際に「未実装である理由」を構造的に返す。

## 4. ツール実装テンプレート

```ts
// src/lib/advisor/tools/tastas-data/get-jobs-summary.ts
import { prisma } from '@/lib/prisma';
import type { AdvisorTool } from '../types';

export const getJobsSummaryTool: AdvisorTool = {
  name: 'get_jobs_summary',
  category: 'tastas-data',
  description: 'TASTAS の求人 (Job テーブル) の状態別件数を取得します。' +
    '質問に「求人数」「アクティブな求人」が含まれる場合に使用。',
  inputSchema: {
    type: 'object',
    properties: {
      status_filter: {
        type: 'array',
        items: { type: 'string', enum: ['active', 'draft', 'suspended', 'closed'] },
        description: '対象の求人ステータス。省略時は全ステータス'
      },
      facility_id: { type: 'string' }
    }
  },
  outputDescription: 'counts は status をキーにした件数オブジェクト',
  async execute(input, ctx) {
    const start = Date.now();
    try {
      const where: any = {};
      if (input.status_filter?.length) where.status = { in: input.status_filter };
      if (input.facility_id) where.facility_id = input.facility_id;

      const grouped = await prisma.job.groupBy({
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
    } catch (err: any) {
      return {
        ok: false,
        error: `求人サマリ取得に失敗: ${err.message}`,
      };
    }
  },
};
```

## 5. ツール呼び出しの安全装置

| 装置 | 実装場所 | 内容 |
|------|---------|------|
| 入力 schema 検証 | orchestrator | Anthropic から来た input を JSON Schema で検証 |
| タイムアウト | tool execute 内 | デフォルト 10秒、長くても 30秒 |
| 行数キャップ | tool execute 内 | DB クエリ結果は最大 1000 行、超えたら truncated:true |
| トークン予算 | orchestrator | tool result を含む合計が 50K 超えたら警告 |
| 個人情報マスキング | tool 出力フィルタ | 電話・メール・名前は将来オプション化 (Phase 1 では admin が見るので raw 表示) |

## 6. 拡張手順 (Lstep を後から追加する例)

```
Step 1: Lstep webhook 受信 API を実装 (/api/lstep/webhook)
Step 2: Prisma に LstepEvent テーブル追加 + db push
Step 3: src/lib/advisor/tools/external/query-lstep.ts 作成
        - inputSchema 定義
        - execute() で LstepEvent.findMany を SELECT
Step 4: src/lib/advisor/tools/external/index.ts に1行追加
        export { queryLstepTool } from './query-lstep'
Step 5: src/lib/advisor/tools/registry.ts は変更不要
        (external/index.ts から自動 import される)
```

→ 工数 1〜2日。チャット側のコード変更ゼロ。

## 7. ツール定義のテストポリシー

- 単体テスト: 各 `execute()` を mock 入力で確認
- 統合テスト: Anthropic への mock レスポンスでツール選択が正しいか確認
- 手動テスト: ローカルで「指標一覧見せて」「LP3のCV率は?」など定型質問を流す (user-checklist.md 参照)
