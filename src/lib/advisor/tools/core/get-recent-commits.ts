import type { AdvisorTool } from '../types';
import { fetchRecentCommits, isGithubAvailable } from '../../knowledge/github-source';

interface Input {
  branch?: string;
  limit?: number;
}

interface CommitItem {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface Output {
  commits: CommitItem[];
  branch: string;
}

export const getRecentCommitsTool: AdvisorTool<Input, Output> = {
  name: 'get_recent_commits',
  category: 'core',
  description:
    'TASTAS リポジトリの最近のコミット履歴を取得します。' +
    '\n\n使用例: 「最近の変更は?」「先週のコミット」「誰が何を変更した?」のような質問。',
  inputSchema: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: 'ブランチ名 (デフォルト: main)',
      },
      limit: {
        type: 'integer',
        description: '取得件数 (デフォルト 20、最大 100)',
        default: 20,
      },
    },
  },
  outputDescription:
    '{ commits: [{ sha (短縮), message (1行目), author, date (ISO), url }], branch }',
  async available() {
    return isGithubAvailable()
      ? { ready: true }
      : {
          ready: false,
          reason: 'GitHub Token (GITHUB_TOKEN_FOR_ADVISOR) が未設定',
        };
  },
  async execute(input, ctx) {
    const start = Date.now();
    try {
      const branch = input.branch ?? 'main';
      const limit = Math.min(input.limit ?? 20, 100);
      const commits = await fetchRecentCommits({ limit, branch, signal: ctx.abortSignal });
      return {
        ok: true,
        data: { commits, branch },
        metadata: { tookMs: Date.now() - start, rowCount: commits.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `コミット履歴取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
