/**
 * デバッグ用時刻管理ユーティリティ
 *
 * System Admin の開発者ポータルから設定可能。
 * クライアントサイドではlocalStorageを使用。
 * サーバーサイドでは環境変数またはグローバル変数を使用。
 */

// サーバーサイド用のグローバル変数（Next.jsのホットリロードでも保持される）
declare global {
  // eslint-disable-next-line no-var
  var debugTimeSettings: { enabled: boolean; time: string | null } | undefined;
}

/**
 * デバッグ時刻設定を取得
 */
export function getDebugTimeSettings(): { enabled: boolean; time: string | null } {
  // クライアントサイドの場合
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('debugTimeSettings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { enabled: false, time: null };
      }
    }
    return { enabled: false, time: null };
  }

  // サーバーサイドの場合 - グローバル変数から読み込み
  return global.debugTimeSettings || { enabled: false, time: null };
}

/**
 * デバッグ時刻設定を保存（クライアントサイド用）
 */
export function setDebugTimeSettings(settings: { enabled: boolean; time: string | null }): void {
  // クライアントサイドの場合
  if (typeof window !== 'undefined') {
    localStorage.setItem('debugTimeSettings', JSON.stringify(settings));
  }
}

/**
 * 現在時刻を取得（デバッグ時刻が有効な場合はそれを返す）
 *
 * new Date() の代わりにこの関数を使用することで、
 * デバッグ時刻による動作検証が可能になる。
 *
 * @returns 現在時刻（またはデバッグ時刻）
 */
export function getCurrentTime(): Date {
  const settings = getDebugTimeSettings();

  if (settings.enabled && settings.time) {
    return new Date(settings.time);
  }

  return new Date();
}

/**
 * 今日の日付を取得（デバッグ時刻対応）
 *
 * @returns YYYY-MM-DD形式の日付文字列
 */
export function getTodayString(): string {
  const now = getCurrentTime();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 今日の日付の開始時刻を取得（デバッグ時刻対応）
 *
 * @returns 今日の0時0分0秒のDateオブジェクト
 */
export function getTodayStart(): Date {
  const now = getCurrentTime();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return todayStart;
}

/**
 * デバッグ時刻が有効かどうか
 */
export function isDebugTimeEnabled(): boolean {
  const settings = getDebugTimeSettings();
  return settings.enabled && !!settings.time;
}
