# [Antigravity 依頼 03] ツールスタブファイルの大量作成

## 目的

System Advisor のツール群 (function calling) のファイル骨格を一括で作成する。中身は Claude Code (本AI) が後で実装するが、ファイル数が多いので **空のスタブファイル**を Antigravity に作らせる。

## 背景

- Phase 3 で Claude Code が各ツールを実装するが、その前にディレクトリ構造とファイル骨格を整えておくと作業効率が良い
- 各ファイルは TypeScript の型を満たすだけの最小実装

## 作業手順

### Step 1: ディレクトリ作成

```bash
mkdir -p src/lib/advisor/tools/core
mkdir -p src/lib/advisor/tools/tastas-data
mkdir -p src/lib/advisor/tools/external
mkdir -p src/lib/advisor/tools/future
```

### Step 2: types.ts を新規作成

`src/lib/advisor/tools/types.ts`:

```typescript
export type ToolCategory = 'core' | 'tastas-data' | 'external' | 'future';

export interface ToolContext {
  adminId: number;
  sessionId: string;
  abortSignal?: AbortSignal;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T; metadata?: { tookMs: number; truncated?: boolean; rowCount?: number } }
  | { ok: false; error: string; userActionable?: string };

export interface AdvisorTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, unknown>;
  outputDescription?: string;
  available?: () => Promise<{ ready: boolean; reason?: string; plannedFrom?: string }>;
  execute: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
}
```

### Step 3: 各カテゴリの index.ts を作成

`src/lib/advisor/tools/core/index.ts`:
```typescript
import type { AdvisorTool } from '../types';
import { readRepoFileTool } from './read-repo-file';
import { searchCodebaseTool } from './search-codebase';
import { readDocTool } from './read-doc';
import { getRecentCommitsTool } from './get-recent-commits';
import { listDirectoryTool } from './list-directory';

export const coreTools: AdvisorTool[] = [
  readRepoFileTool,
  searchCodebaseTool,
  readDocTool,
  getRecentCommitsTool,
  listDirectoryTool,
];
```

`src/lib/advisor/tools/tastas-data/index.ts`:
```typescript
import type { AdvisorTool } from '../types';
import { listAvailableMetricsTool } from './list-available-metrics';
import { queryMetricTool } from './query-metric';
import { getJobsSummaryTool } from './get-jobs-summary';
import { getUsersSummaryTool } from './get-users-summary';
import { getRecentErrorsTool } from './get-recent-errors';
import { describeDbTableTool } from './describe-db-table';

export const tastasDataTools: AdvisorTool[] = [
  listAvailableMetricsTool,
  queryMetricTool,
  getJobsSummaryTool,
  getUsersSummaryTool,
  getRecentErrorsTool,
  describeDbTableTool,
];
```

`src/lib/advisor/tools/external/index.ts`:
```typescript
import type { AdvisorTool } from '../types';
import { queryGa4Tool } from './query-ga4';
import { getVercelLogsTool } from './get-vercel-logs';
import { getVercelDeploymentsTool } from './get-vercel-deployments';
import { getSupabaseLogsTool } from './get-supabase-logs';

export const externalTools: AdvisorTool[] = [
  queryGa4Tool,
  getVercelLogsTool,
  getVercelDeploymentsTool,
  getSupabaseLogsTool,
];
```

`src/lib/advisor/tools/future/index.ts`:
```typescript
import type { AdvisorTool } from '../types';
import { queryLstepEventsTool } from './query-lstep-events';
import { queryLineFriendsTool } from './query-line-friends';
import { querySearchConsoleTool } from './query-search-console';

export const futureTools: AdvisorTool[] = [
  queryLstepEventsTool,
  queryLineFriendsTool,
  querySearchConsoleTool,
];
```

### Step 4: registry.ts を作成

`src/lib/advisor/tools/registry.ts`:

```typescript
import type { AdvisorTool } from './types';
import { coreTools } from './core';
import { tastasDataTools } from './tastas-data';
import { externalTools } from './external';
import { futureTools } from './future';

const allTools: AdvisorTool[] = [
  ...coreTools,
  ...tastasDataTools,
  ...externalTools,
  ...futureTools,
];

export function getAvailableTools(): AdvisorTool[] {
  return allTools;
}

export function findTool(name: string): AdvisorTool | undefined {
  return allTools.find(t => t.name === name);
}

export async function describeAllToolsForLLM() {
  return Promise.all(
    allTools.map(async (t) => {
      let desc = t.description;
      if (t.available) {
        const status = await t.available();
        if (!status.ready) {
          desc += `\n\n⚠️ 現在利用不可: ${status.reason ?? '(理由不明)'}`;
          if (status.plannedFrom) {
            desc += `\n対応予定: ${status.plannedFrom}`;
          }
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

### Step 5: 各ツールのスタブファイル作成

以下のファイルを作成。中身は**全て同じテンプレート**で良い (NotImplementedError を返すだけ)。

#### Core ツール (5ファイル)

各ファイルの中身は以下のテンプレートで、`TOOL_NAME_HERE` と `EXPORT_NAME_HERE` を置き換える:

```typescript
import type { AdvisorTool } from '../types';

export const EXPORT_NAME_HERE: AdvisorTool = {
  name: 'TOOL_NAME_HERE',
  category: 'core',
  description: '(TODO: Phase 3 で Claude Code が実装)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async execute() {
    return { ok: false, error: 'Not implemented yet (Phase 3)' };
  },
};
```

| ファイル名 | TOOL_NAME_HERE | EXPORT_NAME_HERE |
|----------|---------------|-----------------|
| `src/lib/advisor/tools/core/read-repo-file.ts` | `read_repo_file` | `readRepoFileTool` |
| `src/lib/advisor/tools/core/search-codebase.ts` | `search_codebase` | `searchCodebaseTool` |
| `src/lib/advisor/tools/core/read-doc.ts` | `read_doc` | `readDocTool` |
| `src/lib/advisor/tools/core/get-recent-commits.ts` | `get_recent_commits` | `getRecentCommitsTool` |
| `src/lib/advisor/tools/core/list-directory.ts` | `list_directory` | `listDirectoryTool` |

#### TASTAS Data ツール (6ファイル)

`category: 'tastas-data'` でテンプレートを使用:

| ファイル名 | TOOL_NAME_HERE | EXPORT_NAME_HERE |
|----------|---------------|-----------------|
| `src/lib/advisor/tools/tastas-data/list-available-metrics.ts` | `list_available_metrics` | `listAvailableMetricsTool` |
| `src/lib/advisor/tools/tastas-data/query-metric.ts` | `query_metric` | `queryMetricTool` |
| `src/lib/advisor/tools/tastas-data/get-jobs-summary.ts` | `get_jobs_summary` | `getJobsSummaryTool` |
| `src/lib/advisor/tools/tastas-data/get-users-summary.ts` | `get_users_summary` | `getUsersSummaryTool` |
| `src/lib/advisor/tools/tastas-data/get-recent-errors.ts` | `get_recent_errors` | `getRecentErrorsTool` |
| `src/lib/advisor/tools/tastas-data/describe-db-table.ts` | `describe_db_table` | `describeDbTableTool` |

#### External ツール (4ファイル)

`category: 'external'`:

| ファイル名 | TOOL_NAME_HERE | EXPORT_NAME_HERE |
|----------|---------------|-----------------|
| `src/lib/advisor/tools/external/query-ga4.ts` | `query_ga4` | `queryGa4Tool` |
| `src/lib/advisor/tools/external/get-vercel-logs.ts` | `get_vercel_logs` | `getVercelLogsTool` |
| `src/lib/advisor/tools/external/get-vercel-deployments.ts` | `get_vercel_deployments` | `getVercelDeploymentsTool` |
| `src/lib/advisor/tools/external/get-supabase-logs.ts` | `get_supabase_logs` | `getSupabaseLogsTool` |

#### Future ツール (3ファイル) — `available: false` で固定

これらは Phase 1 では未実装。`available()` で必ず false を返すようにする:

各ファイルのテンプレート:

```typescript
import type { AdvisorTool } from '../types';

export const EXPORT_NAME_HERE: AdvisorTool = {
  name: 'TOOL_NAME_HERE',
  category: 'future',
  description: 'REASON_HERE。Phase 1 では未実装のため、呼び出さないでください。',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async available() {
    return {
      ready: false,
      reason: 'REASON_HERE',
      plannedFrom: 'PLANNED_FROM_HERE',
    };
  },
  async execute() {
    return {
      ok: false,
      error: 'このツールは未実装です。代替手段を検討してください。',
      userActionable: 'PLANNED_FROM_HERE で実装予定です。',
    };
  },
};
```

| ファイル名 | TOOL_NAME_HERE | EXPORT_NAME_HERE | REASON_HERE | PLANNED_FROM_HERE |
|----------|---------------|-----------------|-------------|-------------------|
| `src/lib/advisor/tools/future/query-lstep-events.ts` | `query_lstep_events` | `queryLstepEventsTool` | Lstep連携が未実装 | Lstep webhook受信機能の実装後 |
| `src/lib/advisor/tools/future/query-line-friends.ts` | `query_line_friends` | `queryLineFriendsTool` | LINE Webhookが未実装 | LINE Messaging API連携の実装後 (Phase 1 別途) |
| `src/lib/advisor/tools/future/query-search-console.ts` | `query_search_console` | `querySearchConsoleTool` | Google Search Console API未統合 | GSC API統合の実装後 (Phase 2 別途) |

## 完了条件

- [ ] 上記すべてのディレクトリが作成されている
- [ ] `src/lib/advisor/tools/types.ts` が作成されている
- [ ] 4つの `index.ts` が作成されている (core / tastas-data / external / future)
- [ ] `src/lib/advisor/tools/registry.ts` が作成されている
- [ ] 18個のツールスタブファイル (core 5 + tastas-data 6 + external 4 + future 3) が作成されている
- [ ] `npm run build` が型エラーなく成功する

## 作業完了後チェックリスト (必須)

### 1. ビルド確認
```bash
npm run build
```
TypeScript エラーがないこと。

### 2. ファイル数の確認
```bash
ls src/lib/advisor/tools/core/        # 5ファイル + index.ts
ls src/lib/advisor/tools/tastas-data/ # 6ファイル + index.ts
ls src/lib/advisor/tools/external/    # 4ファイル + index.ts
ls src/lib/advisor/tools/future/      # 3ファイル + index.ts
```
合計18ツールスタブ + 4 index + types + registry = 24ファイル

### 3. 動作確認スニペット (オプション)

`scripts/test-advisor-registry.ts` を作って実行してみる:
```typescript
import { getAvailableTools, describeAllToolsForLLM } from '@/lib/advisor/tools/registry';

async function main() {
  const tools = getAvailableTools();
  console.log(`Total: ${tools.length} tools`);
  console.log('Names:', tools.map(t => t.name));

  const described = await describeAllToolsForLLM();
  console.log(`Described: ${described.length}`);
}
main();
```

```bash
tsx scripts/test-advisor-registry.ts
```
→ Total: 18 が出力されればOK。

### 4. 禁止事項の確認
- [ ] git push していない
- [ ] vercel deploy していない
- [ ] DB 操作していない
- [ ] 既存の TASTAS コード (`src/lib/` 配下のレガシーじゃないもの) を変更していない
