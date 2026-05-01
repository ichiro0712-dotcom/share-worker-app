import type { AdvisorTool } from '../types';
import { listAvailableMetricsTool } from './list-available-metrics';
import { queryMetricTool } from './query-metric';
import { getJobsSummaryTool } from './get-jobs-summary';
import { getUsersSummaryTool } from './get-users-summary';
import { getRecentErrorsTool } from './get-recent-errors';
import { describeDbTableTool } from './describe-db-table';

export const tastasDataTools: AdvisorTool[] = [
  listAvailableMetricsTool as unknown as AdvisorTool,
  queryMetricTool as unknown as AdvisorTool,
  getJobsSummaryTool as unknown as AdvisorTool,
  getUsersSummaryTool as unknown as AdvisorTool,
  getRecentErrorsTool as unknown as AdvisorTool,
  describeDbTableTool as unknown as AdvisorTool,
];
