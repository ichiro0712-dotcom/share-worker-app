/**
 * タイムアウトとリトライ機能を持つ fetch ラッパー
 */

export interface FetchWithRetryOptions extends RequestInit {
  /** タイムアウト時間（ミリ秒）。デフォルト: 30000 (30秒) */
  timeout?: number;
  /** 最大リトライ回数。デフォルト: 3 */
  maxRetries?: number;
  /** 初回リトライまでの待機時間（ミリ秒）。デフォルト: 1000 (1秒) */
  retryDelay?: number;
  /** リトライしないHTTPステータスコード。デフォルト: [400, 401, 403, 404, 422] */
  noRetryStatuses?: number[];
}

/**
 * ネットワークエラーを表すカスタムエラークラス
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    /** タイムアウトによるエラーかどうか */
    public readonly isTimeout: boolean = false,
    /** オフライン状態によるエラーかどうか */
    public readonly isOffline: boolean = false,
    /** 元のエラー */
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * 指定時間待機するユーティリティ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * タイムアウトとリトライ機能を持つ fetch
 *
 * @example
 * // 基本的な使用方法
 * const data = await fetchWithRetry('/api/data');
 *
 * @example
 * // オプション指定
 * const data = await fetchWithRetry('/api/data', {
 *   timeout: 10000,      // 10秒タイムアウト
 *   maxRetries: 5,       // 最大5回リトライ
 *   retryDelay: 500,     // 初回500msで指数バックオフ
 * });
 */
export async function fetchWithRetry<T = unknown>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    maxRetries = 3,
    retryDelay = 1000,
    noRetryStatuses = [400, 401, 403, 404, 422],
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // オフライン状態チェック
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new NetworkError(
        'インターネットに接続されていません',
        false,
        true
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // リトライ不要なステータスコードの場合はそのままエラーをスロー
      if (!response.ok) {
        const statusCode = response.status;
        if (noRetryStatuses.includes(statusCode)) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${statusCode}`);
        }

        // リトライ可能なエラー（5xx系など）
        throw new Error(`HTTP ${statusCode}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        // タイムアウト（AbortError）
        if (error.name === 'AbortError') {
          lastError = new NetworkError(
            '通信がタイムアウトしました。電波状況を確認してください。',
            true,
            false,
            error
          );
        }
        // ネットワークエラー（fetchのTypeError）
        else if (error.name === 'TypeError' && error.message.includes('fetch')) {
          lastError = new NetworkError(
            'ネットワークエラーが発生しました。電波状況を確認してください。',
            false,
            false,
            error
          );
        }
        // リトライ不要なエラー（HTTPステータスエラー含む）
        else if (noRetryStatuses.some(status => error.message.includes(`HTTP ${status}`))) {
          throw error;
        }
        // その他のエラー
        else {
          lastError = error;
        }
      }

      // 最後の試行でなければリトライ
      if (attempt < maxRetries) {
        // 指数バックオフ: 1s → 2s → 4s
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error('リクエストに失敗しました');
}

/**
 * JSON POST リクエスト用の便利ラッパー
 *
 * @example
 * const result = await postWithRetry('/api/submit', { name: 'John' });
 */
export async function postWithRetry<T = unknown, B = unknown>(
  url: string,
  body: B,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchWithRetry<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * JSON PUT リクエスト用の便利ラッパー
 */
export async function putWithRetry<T = unknown, B = unknown>(
  url: string,
  body: B,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchWithRetry<T>(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * DELETE リクエスト用の便利ラッパー
 */
export async function deleteWithRetry<T = unknown>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchWithRetry<T>(url, {
    method: 'DELETE',
    ...options,
  });
}
