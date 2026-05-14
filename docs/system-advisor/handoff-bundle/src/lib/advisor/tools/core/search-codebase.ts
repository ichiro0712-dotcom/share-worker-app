import type { AdvisorTool } from '../types';

interface Input {
  query: string;
  file_extension?: string;
  max_results?: number;
}

interface Match {
  path: string;
  url: string;
  snippet?: string;
}

interface Output {
  matches: Match[];
  total_found: number;
  truncated: boolean;
}

const GITHUB_API_BASE = 'https://api.github.com';

export const searchCodebaseTool: AdvisorTool<Input, Output> = {
  name: 'search_codebase',
  category: 'core',
  description:
    'TASTAS リポジトリ内をキーワード検索します (GitHub Code Search API 経由)。' +
    '\n\n使用例: 関数名・定数名・キーワードでファイル検索。' +
    '「authが使われている場所」「getJobsSummary の実装」を探す時に使う。' +
    '\n\n注意: GitHub Code Search はインデックスベースで、最新のコミットが反映されるまで遅延あり。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '検索クエリ。例: "getJobsSummary", "registration_lp_id"',
      },
      file_extension: {
        type: 'string',
        description: 'ファイル拡張子で絞り込み (例: "ts", "tsx", "prisma")',
      },
      max_results: {
        type: 'integer',
        description: '最大件数 (デフォルト 30、最大 100)',
        default: 30,
      },
    },
    required: ['query'],
  },
  outputDescription:
    '{ matches: [{ path, url, snippet? }], total_found, truncated }',
  async available() {
    const token = process.env.GITHUB_TOKEN_FOR_ADVISOR;
    const owner = process.env.ADVISOR_GITHUB_OWNER;
    const repo = process.env.ADVISOR_GITHUB_REPO;
    if (!token || !owner || !repo) {
      return { ready: false, reason: 'GitHub 関連の環境変数が未設定' };
    }
    return { ready: true };
  },
  async execute(input, ctx) {
    const start = Date.now();
    try {
      const token = process.env.GITHUB_TOKEN_FOR_ADVISOR!;
      const owner = process.env.ADVISOR_GITHUB_OWNER!;
      const repo = process.env.ADVISOR_GITHUB_REPO!;
      const query = input.query.trim();
      if (!query) return { ok: false, error: 'query が空です' };

      let searchQuery = `${query} repo:${owner}/${repo}`;
      if (input.file_extension) {
        searchQuery += ` extension:${input.file_extension.replace(/^\./, '')}`;
      }

      const maxResults = Math.min(input.max_results ?? 30, 100);
      const url = `${GITHUB_API_BASE}/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${maxResults}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'tastas-system-advisor/1.0',
        },
        signal: ctx.abortSignal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          error: `GitHub Search API error ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const json = (await res.json()) as {
        total_count: number;
        items: Array<{ path: string; html_url: string }>;
      };

      const matches: Match[] = json.items.map((it) => ({
        path: it.path,
        url: it.html_url,
      }));

      return {
        ok: true,
        data: {
          matches,
          total_found: json.total_count,
          truncated: json.total_count > matches.length,
        },
        metadata: { tookMs: Date.now() - start, rowCount: matches.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `コード検索失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
