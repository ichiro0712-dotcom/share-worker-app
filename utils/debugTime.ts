/**
 * デバッグ用時刻管理ユーティリティ
 *
 * System Admin の開発者ポータルから設定可能。
 * クライアントサイドではlocalStorageとCookieを使用。
 *
 * 注意: サーバーサイドでは、このファイルからインポートした関数は
 * Cookieから読み取れません。サーバーサイド（API Route、Server Actions）では
 * 直接CookieからデバッグタイムをNextRequest経由で取得してください。
 */

const DEBUG_TIME_COOKIE_NAME = 'debugTimeSettings';

/**
 * デバッグ時刻設定を取得（クライアントサイド用）
 */
export function getDebugTimeSettings(): { enabled: boolean; time: string | null } {
  // クライアントサイドの場合
  if (typeof window !== 'undefined') {
    // クライアントではまずlocalStorageを確認
    const stored = localStorage.getItem('debugTimeSettings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fall through to cookie check
      }
    }

    // Cookieからも確認（APIで設定された場合）
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${DEBUG_TIME_COOKIE_NAME}=`))
      ?.split('=')[1];

    if (cookieValue) {
      try {
        return JSON.parse(decodeURIComponent(cookieValue));
      } catch {
        return { enabled: false, time: null };
      }
    }

    return { enabled: false, time: null };
  }

  // サーバーサイドの場合 - このファイルからはCookieにアクセスできない
  // Server Actions や API Route では別途Cookieから読み取る必要がある
  return { enabled: false, time: null };
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
 * 注意: クライアントサイドでのみ正しく動作します。
 * サーバーサイドではCookieからデバッグ時刻を取得してください。
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
 * 今日の日付の開始時刻を取得（デバッグ時刻対応、日本時間ベース）
 *
 * 注意: サーバー（Vercel）はUTCで動作するため、明示的に日本時間（JST）で計算します。
 * これにより、サーバーのタイムゾーンに関係なく、日本時間の0時を基準にした日付が得られます。
 *
 * @returns 今日の0時0分0秒のDateオブジェクト（日本時間ベース、UTCで表現）
 */
export function getTodayStart(): Date {
  const now = getCurrentTime();

  // 日本時間（JST = UTC+9）の日付を取得
  const jstYear = now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric' });
  const jstMonth = now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: '2-digit' });
  const jstDay = now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', day: '2-digit' });

  // 日本時間の0時をUTCで表現（JST 00:00 = UTC 15:00 前日）
  const todayStartJST = new Date(`${jstYear}-${jstMonth}-${jstDay}T00:00:00+09:00`);

  return todayStartJST;
}

/**
 * デバッグ時刻が有効かどうか
 */
export function isDebugTimeEnabled(): boolean {
  const settings = getDebugTimeSettings();
  return settings.enabled && !!settings.time;
}
