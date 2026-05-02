import type { AdvisorTool } from '../types';
import { readRepoFileTool } from './read-repo-file';
import { searchCodebaseTool } from './search-codebase';
import { readDocTool } from './read-doc';
import { getRecentCommitsTool } from './get-recent-commits';
import { listDirectoryTool } from './list-directory';

export const coreTools: AdvisorTool[] = [
  readRepoFileTool as unknown as AdvisorTool,
  searchCodebaseTool as unknown as AdvisorTool,
  readDocTool as unknown as AdvisorTool,
  getRecentCommitsTool as unknown as AdvisorTool,
  listDirectoryTool as unknown as AdvisorTool,
];
