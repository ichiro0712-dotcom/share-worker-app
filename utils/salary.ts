/**
 * 給与計算関連のユーティリティ関数
 *
 * 計算ルール:
 * - ベース給与: 実働時間 × 時給
 * - 残業手当: 8時間超過分 × 時給 × 0.25（1.25倍）
 * - 深夜手当: 22:00〜05:00の勤務時間 × 時給 × 0.25（1.25倍）
 * - 深夜残業: 深夜時間帯の残業 × 時給 × 0.5（1.5倍）
 */

import { calculateSalary } from '@/src/lib/salary-calculator';
import { TRANSPORTATION_FEE_MAX, TRANSPORTATION_FEE_RATE_PER_HOUR } from '@/constants/salary';

// JSTオフセット（+9時間 = 32400000ミリ秒）
// Vercel等のUTCサーバーで Date#setHours / setDate を使うと
// サーバーのローカルタイムゾーン(UTC)で解釈されてJSTと9時間ズレるため、
// 全てUTCプリミティブ+このオフセットでJST時刻を構築する
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 時刻をパースする（翌日プレフィックス対応）
 * @param time - 時刻文字列 (HH:mm または 翌HH:mm 形式)
 * @returns { hour: number, min: number, isNextDay: boolean }
 */
const parseTime = (time: string): { hour: number; min: number; isNextDay: boolean } => {
  const isNextDay = time.startsWith('翌');
  const timePart = isNextDay ? time.slice(1) : time;
  const [hour, min] = timePart.split(':').map(Number);
  return { hour, min, isNextDay };
};

/**
 * 時刻文字列からDateオブジェクトを生成（JST基準）
 *
 * baseDate の JST 日付に対して timeStr の時刻(JST)を設定する。
 * サーバー(UTC)・クライアント(JST)どちらで実行しても同じ結果になる。
 *
 * @param timeStr - 時刻文字列 (HH:mm 形式、または 翌HH:mm)
 * @param isNextDay - 翌日かどうか
 * @param baseDate - 基準日（このDateのJST日付を使用）
 * @returns Date オブジェクト（指定したJST時刻に対応するUTC Date）
 */
const timeStringToDate = (
  timeStr: string,
  isNextDay: boolean,
  baseDate: Date
): Date => {
  const parsed = parseTime(timeStr);
  // baseDateのJST日付を取得（タイムゾーン非依存）
  const baseJst = new Date(baseDate.getTime() + JST_OFFSET_MS);
  const year = baseJst.getUTCFullYear();
  const month = baseJst.getUTCMonth();
  const dayOfMonth = baseJst.getUTCDate() + ((isNextDay || parsed.isNextDay) ? 1 : 0);
  // 「JST year-month-dayOfMonth parsed.hour:parsed.min」を表すUTCタイムスタンプ
  return new Date(
    Date.UTC(year, month, dayOfMonth, parsed.hour, parsed.min, 0, 0) - JST_OFFSET_MS
  );
};

/**
 * 日給を計算する（深夜・残業・深夜残業の割増を含む）
 *
 * 割増計算:
 * - 通常: 1.0倍
 * - 深夜（22:00-05:00）: 1.25倍
 * - 残業（8時間超）: 1.25倍
 * - 深夜残業: 1.5倍
 *
 * @param startTime - 勤務開始時刻 (HH:mm 形式)
 * @param endTime - 勤務終了時刻 (HH:mm 形式、翌日の場合は 翌HH:mm)
 * @param breakTime - 休憩時間（分）
 * @param hourlyWage - 時給（円）
 * @param transportationFee - 交通費（円）
 * @returns 日給（円）
 */
export const calculateDailyWage = (
  startTime: string,
  endTime: string,
  breakTime: number,
  hourlyWage: number,
  transportationFee: number
): number => {
  if (!startTime || !endTime || !hourlyWage) return 0;

  try {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    // 基準日（JSTでの「今日」の 00:00 を表すUTC Date）
    // サーバー(UTC)で new Date().setHours(0,0,0,0) を使うと UTC 00:00 = JST 09:00 になり
    // 後段の calculateSalary が時間帯判定をミスるため、UTCプリミティブで構築する
    const now = new Date();
    const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
    const baseDate = new Date(
      Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), 0, 0, 0, 0) - JST_OFFSET_MS
    );

    // 開始・終了時刻をDateオブジェクトに変換
    const startDate = timeStringToDate(startTime, false, baseDate);
    let endDate = timeStringToDate(endTime, end.isNextDay, baseDate);

    // 終了時刻が開始時刻より前の場合は翌日とみなす（ms加算でTZ非依存）
    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // salary-calculatorを使用して割増計算
    const result = calculateSalary({
      startTime: startDate,
      endTime: endDate,
      breakMinutes: breakTime,
      hourlyRate: hourlyWage,
    });

    // 総支払額 = 給与 + 交通費
    return result.totalPay + transportationFee;
  } catch (error) {
    // エラー時は従来の単純計算にフォールバック
    console.error('[calculateDailyWage] Error:', error);
    return calculateDailyWageSimple(startTime, endTime, breakTime, hourlyWage, transportationFee);
  }
};

/**
 * 日給を単純計算する（フォールバック用）
 * 深夜・残業の割増なし
 */
const calculateDailyWageSimple = (
  startTime: string,
  endTime: string,
  breakTime: number,
  hourlyWage: number,
  transportationFee: number
): number => {
  if (!startTime || !endTime) return 0;

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const startMinutes = start.hour * 60 + start.min;
  let endMinutes = end.hour * 60 + end.min;
  if (end.isNextDay) {
    endMinutes += 24 * 60;
  }

  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  totalMinutes -= breakTime;

  const hours = totalMinutes / 60;
  return Math.ceil(hours * hourlyWage + transportationFee);
};

/**
 * 時給から月給を概算する
 * @param hourlyWage - 時給（円）
 * @param hoursPerDay - 1日の実働時間
 * @param daysPerMonth - 月間勤務日数
 * @returns 月給概算（円）
 */
export const estimateMonthlySalary = (
  hourlyWage: number,
  hoursPerDay: number,
  daysPerMonth: number
): number => {
  return Math.ceil(hourlyWage * hoursPerDay * daysPerMonth);
};

/**
 * 勤務時間から実働時間を計算
 * @param startTime - 勤務開始時刻 (HH:mm 形式)
 * @param endTime - 勤務終了時刻 (HH:mm 形式、翌日の場合は 翌HH:mm)
 * @param breakTime - 休憩時間（分）
 * @returns 実働時間（時間）
 */
export const calculateWorkingHours = (
  startTime: string,
  endTime: string,
  breakTime: number
): number => {
  if (!startTime || !endTime) return 0;

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  // 開始時刻の分換算
  const startMinutes = start.hour * 60 + start.min;

  // 終了時刻の分換算（翌日の場合は24時間分を加算）
  let endMinutes = end.hour * 60 + end.min;
  if (end.isNextDay) {
    endMinutes += 24 * 60;
  }

  let totalMinutes = endMinutes - startMinutes;

  // 日をまたぐ場合の調整（翌プレフィックスがない旧データ対応）
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  totalMinutes -= breakTime;

  return totalMinutes / 60;
};

/**
 * 実働時間から交通費を自動計算
 * - 1時間あたり100円（TRANSPORTATION_FEE_RATE_PER_HOUR）
 * - 1円未満の端数は切り上げ
 * - 上限は800円（TRANSPORTATION_FEE_MAX）
 * @param workingMinutes - 実働時間（分）
 * @returns 交通費（円）
 */
export const calculateTransportationFee = (workingMinutes: number): number => {
  if (workingMinutes <= 0) return 0;

  // 1時間100円 = 1分あたり100/60円
  const fee = (workingMinutes * TRANSPORTATION_FEE_RATE_PER_HOUR) / 60;

  // 1円未満を切り上げて整数円に
  const roundedFee = Math.ceil(fee);

  // 上限を適用
  return Math.min(roundedFee, TRANSPORTATION_FEE_MAX);
};
