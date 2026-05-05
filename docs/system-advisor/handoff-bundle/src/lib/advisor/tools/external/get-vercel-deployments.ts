import type { AdvisorTool } from '../types';

interface Input {
  limit?: number;
  target?: 'production' | 'preview' | 'all';
}

interface DeploymentInfo {
  id: string;
  url: string;
  state: string;
  target: string;
  created_at: string;
  meta?: { branch?: string; commit_sha?: string; commit_message?: string };
}

interface Output {
  deployments: DeploymentInfo[];
  count: number;
}

const VERCEL_API = 'https://api.vercel.com';

export const getVercelDeploymentsTool: AdvisorTool<Input, Output> = {
  name: 'get_vercel_deployments',
  category: 'external',
  description:
    'Vercel の最近のデプロイ一覧と状態を取得します。' +
    '\n\n使用例: 「最近のデプロイ状況」「今日のリリース」「失敗したデプロイは?」',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', default: 10 },
      target: {
        type: 'string',
        enum: ['production', 'preview', 'all'],
        default: 'production',
      },
    },
  },
  outputDescription: '{ deployments: [{ id, url, state, target, created_at, meta }], count }',
  async available() {
    return process.env.VERCEL_API_TOKEN
      ? { ready: true }
      : { ready: false, reason: 'VERCEL_API_TOKEN が未設定' };
  },
  async execute(input, ctx) {
    const start = Date.now();
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) return { ok: false, error: 'VERCEL_API_TOKEN が未設定です' };

    const limit = Math.min(input.limit ?? 10, 50);
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;
    const target = input.target ?? 'production';

    let url = `${VERCEL_API}/v6/deployments?limit=${limit}`;
    if (target !== 'all') url += `&target=${target}`;
    if (projectId) url += `&projectId=${projectId}`;
    if (teamId) url += `&teamId=${teamId}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctx.abortSignal,
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `Vercel deployments API error ${res.status}: ${await res.text().catch(() => '')}`,
        };
      }
      const json = (await res.json()) as {
        deployments: Array<{
          uid: string;
          url: string;
          state: string;
          target: string;
          created: number;
          meta?: { githubCommitRef?: string; githubCommitSha?: string; githubCommitMessage?: string };
        }>;
      };
      const deployments: DeploymentInfo[] = json.deployments.map((d) => ({
        id: d.uid,
        url: `https://${d.url}`,
        state: d.state,
        target: d.target,
        created_at: new Date(d.created).toISOString(),
        meta: {
          branch: d.meta?.githubCommitRef,
          commit_sha: d.meta?.githubCommitSha?.slice(0, 7),
          commit_message: d.meta?.githubCommitMessage?.split('\n')[0],
        },
      }));
      return {
        ok: true,
        data: { deployments, count: deployments.length },
        metadata: { tookMs: Date.now() - start, rowCount: deployments.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `Vercel デプロイ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
