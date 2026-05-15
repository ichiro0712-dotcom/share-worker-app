import type { AdvisorTool } from '../types';
import { queryMetricTool } from './query-metric';
import { getJobsSummaryTool } from './get-jobs-summary';
import { getUsersSummaryTool } from './get-users-summary';
import { getRecentErrorsTool } from './get-recent-errors';
import { describeDbTableTool } from './describe-db-table';
import { executeSqlTool } from './execute-sql';

// list_available_metrics は system prompt にカタログを静的埋め込みすることで廃止した。
// (Claude のツール round-trip を 1 回減らすため。詳細: src/lib/advisor/system-prompt.ts)
export const tastasDataTools: AdvisorTool[] = [
  queryMetricTool as unknown as AdvisorTool,
  getJobsSummaryTool as unknown as AdvisorTool,
  getUsersSummaryTool as unknown as AdvisorTool,
  getRecentErrorsTool as unknown as AdvisorTool,
  describeDbTableTool as unknown as AdvisorTool,
  executeSqlTool as unknown as AdvisorTool,
];
