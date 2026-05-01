import type { AdvisorTool } from '../types';
import { fetchGithubFile, isGithubAvailable } from '../../knowledge/github-source';

const DENY_PATTERNS = [
  /^node_modules\//,
  /^\.env/,
  /^\.git\//,
  /^\.next\//,
  /^_legacy_agent-hub\//,
  /\.(jpg|jpeg|png|gif|webp|ico|pdf|zip|woff2?|ttf|otf|mp3|mp4)$/i,
];

const MAX_BYTES_DEFAULT = 100_000;
const MAX_BYTES_HARD_LIMIT = 500_000;

interface Input {
  path: string;
  max_bytes?: number;
}

interface Output {
  path: string;
  content: string;
  byte_size: number;
  truncated: boolean;
  source: 'github';
}

export const readRepoFileTool: AdvisorTool<Input, Output> = {
  name: 'read_repo_file',
  category: 'core',
  description:
    'TASTAS リポジトリ (GitHub main ブランチ) の任意のファイル内容を読み取ります。' +
    '\n\n使用例: source code を確認したい場合、ドキュメントを読みたい場合に使用。' +
    '\nバイナリ・巨大ファイル・機密ファイルへのアクセスは拒否されます。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'リポジトリルートからの相対パス。例: "src/lib/auth.ts", "prisma/schema.prisma"',
      },
      max_bytes: {
        type: 'integer',
        description: '最大バイト数 (デフォルト 100000、最大 500000)',
        default: 100_000,
      },
    },
    required: ['path'],
  },
  outputDescription:
    '{ path, content (UTF-8 文字列), byte_size, truncated (上限超過なら true), source }',
  async available() {
    return isGithubAvailable()
      ? { ready: true }
      : {
          ready: false,
          reason: 'GitHub Token (GITHUB_TOKEN_FOR_ADVISOR) が未設定',
          plannedFrom: '環境変数の設定後に利用可能',
        };
  },
  async execute(input, ctx) {
    const start = Date.now();
    try {
      const path = input.path.replace(/^\/+/, '').trim();
      if (!path) {
        return { ok: false, error: 'path is empty' };
      }
      if (path.includes('..')) {
        return { ok: false, error: 'path に ".." を含めることはできません' };
      }
      for (const pat of DENY_PATTERNS) {
        if (pat.test(path)) {
          return {
            ok: false,
            error: `このパスは読み取り対象外です: ${path}`,
            userActionable: '別のファイルを指定してください',
          };
        }
      }

      const maxBytes = Math.min(input.max_bytes ?? MAX_BYTES_DEFAULT, MAX_BYTES_HARD_LIMIT);

      const file = await fetchGithubFile({ path, signal: ctx.abortSignal });
      let content = file.content;
      let truncated = false;
      if (content.length > maxBytes) {
        content = content.slice(0, maxBytes);
        truncated = true;
      }

      return {
        ok: true,
        data: {
          path,
          content,
          byte_size: file.size,
          truncated,
          source: 'github',
        },
        metadata: { tookMs: Date.now() - start, truncated },
      };
    } catch (e) {
      return {
        ok: false,
        error: `ファイル取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
