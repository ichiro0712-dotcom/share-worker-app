import type { AdvisorTool } from '../types';
import { fetchGithubDirectory, isGithubAvailable } from '../../knowledge/github-source';

interface Input {
  path?: string;
}

interface Item {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
}

interface Output {
  path: string;
  items: Item[];
  count: number;
}

export const listDirectoryTool: AdvisorTool<Input, Output> = {
  name: 'list_directory',
  category: 'core',
  description:
    'TASTAS リポジトリのディレクトリ内のファイル・サブディレクトリ一覧を取得します。' +
    '\n\n使用例: 「src/lib にどんなファイルがある?」「app/api 配下の構造」を知りたい時。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'ディレクトリパス。省略時はリポジトリルート',
        default: '',
      },
    },
  },
  outputDescription:
    '{ path, items: [{ name, path, type ("file"|"dir"), size }], count }',
  async available() {
    return isGithubAvailable()
      ? { ready: true }
      : { ready: false, reason: 'GitHub Token が未設定' };
  },
  async execute(input, ctx) {
    const start = Date.now();
    try {
      const path = (input.path ?? '').replace(/^\/+|\/+$/g, '');
      const items = await fetchGithubDirectory({ path, signal: ctx.abortSignal });
      return {
        ok: true,
        data: { path: path || '(root)', items, count: items.length },
        metadata: { tookMs: Date.now() - start, rowCount: items.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `ディレクトリ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
