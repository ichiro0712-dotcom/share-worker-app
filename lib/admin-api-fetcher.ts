'use client';

/**
 * Admin API用のフェッチャーユーティリティ
 * 401/403エラーを検知して認証エラーを通知
 */

// 認証エラーを通知するためのカスタムイベント
export const ADMIN_AUTH_ERROR_EVENT = 'admin-auth-error';

export interface AdminAuthErrorDetail {
  code: 'UNAUTHORIZED' | 'FORBIDDEN';
  message: string;
}

/**
 * 認証エラーイベントを発火
 */
export function dispatchAdminAuthError(detail: AdminAuthErrorDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_ERROR_EVENT, { detail }));
  }
}

/**
 * Admin API用のフェッチャー
 * 401/403エラーを検知してイベントを発火
 */
export async function adminFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    dispatchAdminAuthError({
      code: 'UNAUTHORIZED',
      message: data.error || '認証が必要です',
    });
    throw new Error('UNAUTHORIZED');
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    dispatchAdminAuthError({
      code: 'FORBIDDEN',
      message: data.error || 'アクセス権限がありません',
    });
    throw new Error('FORBIDDEN');
  }

  if (!res.ok) {
    throw new Error('Failed to fetch');
  }

  return res.json();
}

/**
 * Admin API用のPOSTフェッチャー
 */
export async function adminPostFetcher<T, B = unknown>(url: string, body: B): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    dispatchAdminAuthError({
      code: 'UNAUTHORIZED',
      message: data.error || '認証が必要です',
    });
    throw new Error('UNAUTHORIZED');
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    dispatchAdminAuthError({
      code: 'FORBIDDEN',
      message: data.error || 'アクセス権限がありません',
    });
    throw new Error('FORBIDDEN');
  }

  if (!res.ok) {
    throw new Error('Failed to fetch');
  }

  return res.json();
}
