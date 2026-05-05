import type { AdvisorTool } from '../types';
import { queryLstepEventsTool } from './query-lstep-events';
import { queryLineFriendsTool } from './query-line-friends';

export const futureTools: AdvisorTool[] = [
  queryLstepEventsTool,
  queryLineFriendsTool,
];
