/**
 * GitHub Contents API 経由でリポジトリ内ファイルを取得する。
 *
 * - 認証は Personal Access Token (GITHUB_TOKEN_FOR_ADVISOR)
 * - レート制限: 認証付きで 5000 req/h
 * - 大きいファイルは別 API (blob) になるが Phase 1 では Contents API のみ対応
 *
 * 使い方:
 *   const file = await fetchGithubFile({ path: 'CLAUDE.md' });
 *   console.log(file.content); // base64 デコード済みのテキスト
 */

const GITHUB_API_BASE = 'https://api.github.com';

export interface GithubFileResult {
  /** リクエストしたパス (そのまま返す) */
  path: string;
  /** デコード済みコンテンツ (UTF-8 文字列) */
  content: string;
  /** GitHub blob SHA (バージョン管理用) */
  sha: string;
  /** バイト数 */
  size: number;
}

export interface GithubAuthConfig {
  /** PAT が無ければ null (= anonymous アクセス、public repo は読める / rate 60/h) */
  token: string | null;
  owner: string;
  repo: string;
  ref?: string; // ブランチ名 (default: main)
}

/**
 * GitHub アクセス設定を取得。
 *
 * - owner / repo / ref は **default 値** (TASTAS リポジトリ) を持つ
 * - token は GITHUB_TOKEN_FOR_ADVISOR > GITHUB_TOKEN > null の優先順位
 * - token が無い場合は anonymous アクセス (public repo なら読める / rate 60/h)
 *
 * 旧仕様 (env 全部必須で hard fail) は「PAT を一時的に外したい」「default repo で
 * 動かしたい」 場合に Advisor が完全停止する不具合があったため変更。
 */
function getAuthConfig(): GithubAuthConfig {
  const token =
    process.env.GITHUB_TOKEN_FOR_ADVISOR ?? process.env.GITHUB_TOKEN ?? null;
  const owner = process.env.ADVISOR_GITHUB_OWNER ?? 'ichiro0712-dotcom';
  const repo = process.env.ADVISOR_GITHUB_REPO ?? 'share-worker-app';
  return { token, owner, repo, ref: process.env.ADVISOR_GITHUB_REF ?? 'main' };
}

/**
 * fetch ヘッダー組み立て。 token がある時のみ Authorization を付ける。
 */
function buildGithubHeaders(cfg: GithubAuthConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tastas-system-advisor/1.0',
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
  return headers;
}

/** GitHub からファイルを取得 (Contents API) */
export async function fetchGithubFile(opts: {
  path: string;
  signal?: AbortSignal;
}): Promise<GithubFileResult> {
  const cfg = getAuthConfig();
  const url = `${GITHUB_API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, '/')}?ref=${cfg.ref}`;

  const res = await fetch(url, {
    headers: buildGithubHeaders(cfg),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error ${res.status} for ${opts.path}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    type: string;
    encoding: string;
    content: string;
    sha: string;
    size: number;
  };

  if (json.type !== 'file') {
    throw new Error(`${opts.path} is not a file (type=${json.type})`);
  }

  // GitHub returns base64-encoded content (with line breaks)
  const content =
    json.encoding === 'base64'
      ? Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      : json.content;

  return {
    path: opts.path,
    content,
    sha: json.sha,
    size: json.size,
  };
}

/** ディレクトリの一覧を取得 (型: file/dir 両方含む) */
export async function fetchGithubDirectory(opts: {
  path: string;
  signal?: AbortSignal;
}): Promise<{ name: string; path: string; type: 'file' | 'dir'; size: number }[]> {
  const cfg = getAuthConfig();
  const url = `${GITHUB_API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, '/')}?ref=${cfg.ref}`;

  const res = await fetch(url, {
    headers: buildGithubHeaders(cfg),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error ${res.status} for ${opts.path}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>;

  if (!Array.isArray(json)) {
    throw new Error(`${opts.path} is not a directory`);
  }

  return json
    .filter((it) => it.type === 'file' || it.type === 'dir')
    .map((it) => ({
      name: it.name,
      path: it.path,
      type: it.type as 'file' | 'dir',
      size: it.size,
    }));
}

/** 最近のコミット一覧 */
export interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export async function fetchRecentCommits(opts: {
  limit?: number;
  branch?: string;
  signal?: AbortSignal;
}): Promise<GithubCommit[]> {
  const cfg = getAuthConfig();
  const limit = Math.min(opts.limit ?? 20, 100);
  const branch = opts.branch ?? cfg.ref;
  const url = `${GITHUB_API_BASE}/repos/${cfg.owner}/${cfg.repo}/commits?sha=${branch}&per_page=${limit}`;

  const res = await fetch(url, {
    headers: buildGithubHeaders(cfg),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub commits API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }>;

  return json.map((it) => ({
    sha: it.sha.slice(0, 7),
    message: it.commit.message.split('\n')[0],
    author: it.commit.author.name,
    date: it.commit.author.date,
    url: it.html_url,
  }));
}

/**
 * GitHub API がアクセス可能か。
 * default 値経由で常にアクセス可能 (token なしでも anonymous 60/h で動く)。
 *
 * 各ツールの `available()` 判定で「token 必須」(例: search_codebase は GitHub Search API
 * が anonymous で 422 を返すため PAT 必須) なものは、 `getGithubAccessLevel()` で
 * `authenticated` を見て判定すること。
 */
export function isGithubAvailable(): boolean {
  return true;
}

/**
 * GitHub アクセスレベル詳細。
 * - PAT 設定済 → authenticated=true (5000/h)
 * - PAT 未設定 → authenticated=false (anonymous 60/h、 public repo のみ)
 */
export function getGithubAccessLevel(): {
  available: boolean;
  authenticated: boolean;
  reason: string;
} {
  const hasToken = !!(
    process.env.GITHUB_TOKEN_FOR_ADVISOR ?? process.env.GITHUB_TOKEN
  );
  return hasToken
    ? {
        available: true,
        authenticated: true,
        reason: 'PAT 認証済 (GitHub API rate limit: 5000/h)',
      }
    : {
        available: true,
        authenticated: false,
        reason: 'anonymous アクセス (PAT 未設定、 rate limit: 60/h、 public repo のみ)',
      };
}
