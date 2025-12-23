/**
 * デバッグ用時刻管理ユーティリティ（サーバーサイド専用）
 *
 * サーバーレス環境（Netlify等）ではグローバル変数が保持されないため、
 * Cookieベースで設定を読み取る。
 *
 * NextRequestからCookieを読み取る場合に使用。
 */

export const DEBUG_TIME_COOKIE_NAME = 'debugTimeSettings';

export interface DebugTimeSettings {
  enabled: boolean;
  time: string | null;
}

/**
 * Cookieの値からデバッグ時刻設定をパース
 */
export function parseDebugTimeCookie(cookieValue: string | undefined): DebugTimeSettings {
  if (!cookieValue) {
    return { enabled: false, time: null };
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[parseDebugTimeCookie] Error:', error);
    return { enabled: false, time: null };
  }
}

/**
 * デバッグ時刻設定から現在時刻を取得
 */
export function getCurrentTimeFromSettings(settings: DebugTimeSettings): Date {
  if (settings.enabled && settings.time) {
    return new Date(settings.time);
  }
  return new Date();
}
