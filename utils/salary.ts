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
 * @param timeStr - 時刻文字列 (HH:mm 形式)
 * @param isNextDay - 翌日かどうか
 * @param baseDate - 基準日（省略時は今日）
 * @returns Date オブジェクト
 */
const timeStringToDate = (
  timeStr: string,
  isNextDay: boolean,
  baseDate: Date = new Date()
): Date => {
  const parsed = parseTime(timeStr);
  const date = new Date(baseDate);
  date.setHours(parsed.hour, parsed.min, 0, 0);
  if (isNextDay || parsed.isNextDay) {
    date.setDate(date.getDate() + 1);
  }
  return date;
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

    // 基準日を設定（JST）
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    // 開始・終了時刻をDateオブジェクトに変換
    const startDate = timeStringToDate(startTime, false, baseDate);
    let endDate = timeStringToDate(endTime, end.isNextDay, baseDate);

    // 終了時刻が開始時刻より前の場合は翌日とみなす
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
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
 * 実働時間から最低交通費を計算
 * 1時間あたり100円（15分あたり25円）
 * @param workingMinutes - 実働時間（分）
 * @returns 最低交通費（円）、25円刻みに切り上げ
 */
export const calculateMinTransportationFee = (workingMinutes: number): number => {
  if (workingMinutes <= 0) return 0;

  // 1時間100円 = 1分あたり100/60円
  const minFee = (workingMinutes * 100) / 60;

  // 25円刻みに切り上げ
  return Math.ceil(minFee / 25) * 25;
};

/**
 * 勤務時間に応じてフィルタリングされた交通費選択肢を取得
 * @param workingMinutes - 実働時間（分）
 * @param options - 元の交通費選択肢
 * @returns フィルタリングされた選択肢
 */
export const getFilteredTransportationFeeOptions = <T extends { value: number; label: string }>(
  workingMinutes: number,
  options: readonly T[]
): T[] => {
  const minFee = calculateMinTransportationFee(workingMinutes);

  // 0円（なし）は常に表示、それ以外は最低額以上のものを表示
  return options.filter(option => option.value === 0 || option.value >= minFee);
};
