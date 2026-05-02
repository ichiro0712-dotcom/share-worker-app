import type { AdvisorTool } from '../types';
import { queryGa4Tool } from './query-ga4';
import { getVercelLogsTool } from './get-vercel-logs';
import { getVercelDeploymentsTool } from './get-vercel-deployments';
import { getSupabaseLogsTool } from './get-supabase-logs';
import { querySearchConsoleTool } from './query-search-console';

export const externalTools: AdvisorTool[] = [
  queryGa4Tool as unknown as AdvisorTool,
  getVercelLogsTool as unknown as AdvisorTool,
  getVercelDeploymentsTool as unknown as AdvisorTool,
  getSupabaseLogsTool as unknown as AdvisorTool,
  querySearchConsoleTool as unknown as AdvisorTool,
];
