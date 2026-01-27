/**
 * CSV出力共通ユーティリティ
 * CROSSNAVI連携用のCSV生成に使用
 */

/**
 * CSV文字列生成
 * @param headers ヘッダー行の配列
 * @param rows データ行の2次元配列
 * @returns CSV文字列（CRLF改行）
 */
export function generateCsv(headers: string[], rows: string[][]): string {
  const escapeField = (field: string | null | undefined): string => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    // カンマ、ダブルクォート、改行を含む場合はエスケープ
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeField).join(',');
  const dataRows = rows.map(row => row.map(escapeField).join(',')).join('\r\n');

  return headerRow + '\r\n' + dataRows;
}

/**
 * 日付フォーマット（yyyy/mm/dd）
 * @param date Date型またはnull/undefined
 * @returns yyyy/mm/dd形式の文字列、または空文字
 */
export function formatDateForCsv(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 時刻フォーマット（hh:mm）
 * @param time 時刻文字列（"HH:MM:SS" or "HH:MM"形式）
 * @returns hh:mm形式の文字列、または空文字
 */
export function formatTimeForCsv(time: string | null | undefined): string {
  if (!time) return '';
  // "HH:MM:SS" or "HH:MM" format
  return time.slice(0, 5);
}

/**
 * 実働時間計算（hh:mm形式で返す）
 * @param startTime 開始時刻（"HH:MM"形式）
 * @param endTime 終了時刻（"HH:MM"形式）
 * @param breakMinutes 休憩時間（分）
 * @returns hh:mm形式の実働時間
 */
export function calculateWorkingHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): string {
  if (!startTime || !endTime) return '00:00';

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return '00:00';
  }

  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60; // 日跨ぎ対応

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 分数を hh:mm 形式に変換
 * @param minutes 分数
 * @returns hh:mm形式の文字列
 */
export function formatMinutesToTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '00:00';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
