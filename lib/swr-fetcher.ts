/**
 * SWR 用のフェッチャー関数
 * fetch-with-retry を使用してネットワーク障害に強いデータ取得を実現
 */

import { fetchWithRetry, NetworkError } from './fetch-with-retry';

/**
 * SWR 用の標準フェッチャー
 *
 * 特徴:
 * - 30秒タイムアウト
 * - 最大2回リトライ（SWR自体にもリトライ機能があるため控えめ）
 * - ネットワークエラー時のユーザーフレンドリーなメッセージ
 *
 * @example
 * import { swrFetcher } from '@/lib/swr-fetcher';
 *
 * const { data, error } = useSWR('/api/data', swrFetcher);
 */
export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  try {
    return await fetchWithRetry<T>(url, {
      timeout: 30000,     // 30秒
      maxRetries: 2,      // SWR自体にリトライがあるため控えめ
      retryDelay: 500,    // 500ms から開始
    });
  } catch (error) {
    if (error instanceof NetworkError) {
      // ネットワークエラーはそのままスロー（メッセージはユーザーフレンドリー）
      throw error;
    }
    // その他のエラーは汎用メッセージに変換
    throw new Error('データの取得に失敗しました');
  }
}

/**
 * 管理者用 SWR フェッチャー
 * 認証エラー時の特別なハンドリングを含む
 *
 * @example
 * const { data, error } = useSWR('/api/admin/data', swrAdminFetcher);
 */
export async function swrAdminFetcher<T = unknown>(url: string): Promise<T> {
  try {
    return await fetchWithRetry<T>(url, {
      timeout: 30000,
      maxRetries: 2,
      retryDelay: 500,
      // 認証エラーはリトライしない
      noRetryStatuses: [400, 401, 403, 404, 422],
    });
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    // 認証エラーはそのままスロー（上位でハンドリング）
    if (error instanceof Error && (
      error.message.includes('401') ||
      error.message.includes('403') ||
      error.message === 'UNAUTHORIZED' ||
      error.message === 'FORBIDDEN'
    )) {
      throw error;
    }
    throw new Error('データの取得に失敗しました');
  }
}
