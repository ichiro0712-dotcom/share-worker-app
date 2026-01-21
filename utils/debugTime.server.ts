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

/**
 * 日本時間（JST）での今日の開始時刻を取得
 * サーバーがUTCで動作していても、JSTの00:00:00を返す
 */
export function getJSTTodayStart(baseTime?: Date): Date {
  const now = baseTime || new Date();

  // JSTのオフセット（+9時間 = 540分）
  const JST_OFFSET = 9 * 60;

  // UTCでの現在時刻をJSTに変換
  const jstTime = new Date(now.getTime() + JST_OFFSET * 60 * 1000);

  // JSTでの今日の00:00:00を計算
  const jstTodayStart = new Date(Date.UTC(
    jstTime.getUTCFullYear(),
    jstTime.getUTCMonth(),
    jstTime.getUTCDate(),
    0, 0, 0, 0
  ));

  // JSTの00:00をUTCに戻す（-9時間）
  return new Date(jstTodayStart.getTime() - JST_OFFSET * 60 * 1000);
}

/**
 * 任意の日付をJST基準の日の開始時刻（00:00:00 JST）に正規化
 * DBから取得した日付を比較用に正規化する際に使用
 */
export function normalizeToJSTDayStart(date: Date): Date {
  const JST_OFFSET = 9 * 60;

  // 日付をJSTに変換
  const jstTime = new Date(date.getTime() + JST_OFFSET * 60 * 1000);

  // JSTでの日の00:00:00を計算
  const jstDayStart = new Date(Date.UTC(
    jstTime.getUTCFullYear(),
    jstTime.getUTCMonth(),
    jstTime.getUTCDate(),
    0, 0, 0, 0
  ));

  // JSTの00:00をUTCに戻す（-9時間）
  return new Date(jstDayStart.getTime() - JST_OFFSET * 60 * 1000);
}

/**
 * 日本時間（JST）での今日の日付文字列を取得（YYYY-MM-DD形式）
 */
export function getJSTTodayString(baseTime?: Date): string {
  const now = baseTime || new Date();

  // JSTのオフセット（+9時間 = 540分）
  const JST_OFFSET = 9 * 60;

  // UTCでの現在時刻をJSTに変換
  const jstTime = new Date(now.getTime() + JST_OFFSET * 60 * 1000);

  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 日付の時刻をJST基準で設定する
 * 入力日付のJSTでの日付部分を維持したまま、指定した時刻（JST）を設定
 *
 * 例: 2026-01-20 (どのタイムゾーンでも) に 9:00 JST を設定
 *     → 2026-01-20 00:00:00 UTC (= 2026-01-20 09:00:00 JST)
 *
 * @param date 基準となる日付
 * @param hours JST時刻の時（0-23）
 * @param minutes JST時刻の分（0-59）、デフォルト0
 * @param seconds JST時刻の秒（0-59）、デフォルト0
 * @param milliseconds JST時刻のミリ秒（0-999）、デフォルト0
 * @returns 指定したJST時刻に対応するUTC Date
 */
export function setJSTHours(
  date: Date,
  hours: number,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0
): Date {
  const JST_OFFSET = 9 * 60;

  // 入力日付をJSTに変換して日付部分を取得
  const jstTime = new Date(date.getTime() + JST_OFFSET * 60 * 1000);

  // JSTでの指定時刻を計算
  const jstTarget = new Date(Date.UTC(
    jstTime.getUTCFullYear(),
    jstTime.getUTCMonth(),
    jstTime.getUTCDate(),
    hours,
    minutes,
    seconds,
    milliseconds
  ));

  // JSTの時刻をUTCに戻す（-9時間）
  return new Date(jstTarget.getTime() - JST_OFFSET * 60 * 1000);
}
