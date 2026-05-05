/**
 * JST (日本標準時) ヘルパー
 *
 * このサービスは日本国内向けのため、日付・時刻の比較や保存は必ずJST基準で行う。
 * Vercelサーバーは UTC で動作するため、`new Date()` をそのまま使うとJSTと最大9時間ズレる。
 *
 * 既存の src/lib/actions/minimumWage.ts と同等の実装を Advisor 専用に独立させたもの。
 */

const JST_OFFSET_HOURS = 9;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Date を JST の `YYYY-MM-DD` 文字列に変換 */
export function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_HOURS * MS_PER_HOUR);
  return jst.toISOString().slice(0, 10);
}

/** 今日の JST 00:00:00 を Date で返す (UTC 表現で 15:00 前日 になる) */
export function getTodayJSTStart(): Date {
  const now = new Date();
  const jstNow = new Date(now.getTime() + JST_OFFSET_HOURS * MS_PER_HOUR);
  const yyyyMmDd = jstNow.toISOString().slice(0, 10);
  return new Date(`${yyyyMmDd}T00:00:00+09:00`);
}

/** 指定日時を JST の "YYYY-MM-DD HH:mm:ss" 文字列にフォーマット */
export function formatJST(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_HOURS * MS_PER_HOUR);
  const isoStr = jst.toISOString();
  return `${isoStr.slice(0, 10)} ${isoStr.slice(11, 19)}`;
}

/** 日付文字列 "YYYY-MM-DD" を JST 0:00 の Date に変換 */
export function parseJSTDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00+09:00`);
}

/** 日付文字列 "YYYY-MM-DD" の JST 翌日 0:00 直前 (23:59:59.999) を返す */
export function getJSTDayEnd(dateString: string): Date {
  const start = parseJSTDate(dateString);
  return new Date(start.getTime() + 24 * MS_PER_HOUR - 1);
}
