/**
 * 給与計算ユーティリティ
 *
 * 計算ルール:
 * - ベース給与: 実働時間 × 時給
 * - 残業手当: 8時間超過分 × 時給 × 0.25
 * - 深夜手当: 22:00〜05:00の勤務時間 × 時給 × 0.25
 * - 深夜+残業: 1.5倍（ベース + 残業0.25 + 深夜0.25）
 * - 休憩時間は最も時給が高い時間帯から優先的に控除
 */

export interface SalaryCalculationInput {
  startTime: Date;      // 勤務開始時刻
  endTime: Date;        // 勤務終了時刻
  breakMinutes: number; // 休憩時間（分）
  hourlyRate: number;   // 時給
}

export interface TimeBlock {
  startTime: Date;
  endTime: Date;
  hours: number;
  type: 'normal' | 'night' | 'overtime' | 'night_overtime';
  rate: number;         // 倍率
  amount: number;       // 金額
}

export interface SalaryCalculationResult {
  basePay: number;         // ベース給与
  overtimePay: number;     // 残業手当
  nightPay: number;        // 深夜手当
  totalPay: number;        // 合計
  workedMinutes: number;   // 実働時間（分）
  overtimeMinutes: number; // 残業時間（分）
  nightMinutes: number;    // 深夜時間（休憩控除後、分）
  breakdown: TimeBlock[];  // 時間帯別内訳
}

// 深夜時間帯の定義（22:00〜05:00）
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;

// 残業開始時間（8時間 = 480分）
const OVERTIME_THRESHOLD_MINUTES = 8 * 60;

/**
 * 指定した時刻が深夜時間帯かどうかを判定
 */
function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/**
 * 2つの時刻間の分数を計算
 */
function getMinutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * 日付を指定した時間に設定（同日または翌日）
 */
function setTimeOnDate(baseDate: Date, hour: number, isNextDay: boolean = false): Date {
  const result = new Date(baseDate);
  if (isNextDay) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(hour, 0, 0, 0);
  return result;
}

/**
 * 勤務時間を時間帯ごとに分割
 */
function splitWorkPeriodIntoSegments(startTime: Date, endTime: Date): Array<{
  start: Date;
  end: Date;
  isNight: boolean;
}> {
  const segments: Array<{ start: Date; end: Date; isNight: boolean }> = [];
  let current = new Date(startTime);

  while (current < endTime) {
    const currentHour = current.getHours();
    const isCurrentNight = isNightTime(current);

    // 次の境界時刻を計算
    let nextBoundary: Date;

    if (isCurrentNight) {
      // 深夜時間帯の場合
      if (currentHour >= NIGHT_START_HOUR) {
        // 22時以降 → 翌5時が境界
        nextBoundary = setTimeOnDate(current, NIGHT_END_HOUR, true);
      } else {
        // 0時〜5時 → 5時が境界
        nextBoundary = setTimeOnDate(current, NIGHT_END_HOUR, false);
      }
    } else {
      // 通常時間帯の場合
      if (currentHour < NIGHT_START_HOUR) {
        // 22時が境界
        nextBoundary = setTimeOnDate(current, NIGHT_START_HOUR, false);
      } else {
        // 翌22時が境界（通常ここには来ない）
        nextBoundary = setTimeOnDate(current, NIGHT_START_HOUR, true);
      }
    }

    // セグメントの終了時刻
    const segmentEnd = nextBoundary < endTime ? nextBoundary : endTime;

    if (segmentEnd > current) {
      segments.push({
        start: new Date(current),
        end: new Date(segmentEnd),
        isNight: isCurrentNight
      });
    }

    current = new Date(segmentEnd);
  }

  return segments;
}

/**
 * 給与を計算
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const { startTime, endTime, breakMinutes, hourlyRate } = input;

  // 総拘束時間（分）
  const totalMinutes = getMinutesBetween(startTime, endTime);

  // 実働時間（分）
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

  // 時間帯ごとにセグメント分割
  const segments = splitWorkPeriodIntoSegments(startTime, endTime);

  // 各セグメントの時間を計算
  let normalMinutes = 0;
  let nightMinutes = 0;

  for (const segment of segments) {
    const minutes = getMinutesBetween(segment.start, segment.end);
    if (segment.isNight) {
      nightMinutes += minutes;
    } else {
      normalMinutes += minutes;
    }
  }

  // 休憩時間を深夜時間から優先的に控除
  let adjustedNightMinutes = nightMinutes;
  let adjustedNormalMinutes = normalMinutes;
  let remainingBreak = breakMinutes;

  // 深夜時間から休憩を控除
  if (remainingBreak > 0 && adjustedNightMinutes > 0) {
    const deductFromNight = Math.min(remainingBreak, adjustedNightMinutes);
    adjustedNightMinutes -= deductFromNight;
    remainingBreak -= deductFromNight;
  }

  // 残りがあれば通常時間から控除
  if (remainingBreak > 0 && adjustedNormalMinutes > 0) {
    const deductFromNormal = Math.min(remainingBreak, adjustedNormalMinutes);
    adjustedNormalMinutes -= deductFromNormal;
    remainingBreak -= deductFromNormal;
  }

  // 残業時間の計算
  const overtimeMinutes = Math.max(0, workedMinutes - OVERTIME_THRESHOLD_MINUTES);
  const regularMinutes = workedMinutes - overtimeMinutes;

  // 深夜残業時間の計算
  // 残業は後半の時間に発生するため、深夜時間と残業時間の重複を計算
  // 勤務開始から8時間経過後の深夜時間が深夜残業
  let nightOvertimeMinutes = 0;
  let nightRegularMinutes = adjustedNightMinutes;

  if (overtimeMinutes > 0) {
    // 累積時間を計算して、8時間超過後の深夜時間を特定
    let accumulatedMinutes = 0;

    for (const segment of segments) {
      const segmentMinutes = getMinutesBetween(segment.start, segment.end);
      const segmentStart = accumulatedMinutes;
      const segmentEnd = accumulatedMinutes + segmentMinutes;

      // このセグメントの残業部分（8時間超過後の部分）
      const overtimeStart = Math.max(segmentStart, OVERTIME_THRESHOLD_MINUTES);
      const overtimeEnd = segmentEnd;

      if (overtimeEnd > overtimeStart && segment.isNight) {
        nightOvertimeMinutes += overtimeEnd - overtimeStart;
      }

      accumulatedMinutes = segmentEnd;
    }

    // 休憩控除後の深夜時間に対する深夜残業の比率を適用
    if (nightMinutes > 0) {
      const nightRatio = adjustedNightMinutes / nightMinutes;
      nightOvertimeMinutes = Math.round(nightOvertimeMinutes * nightRatio);
    }

    // 深夜通常時間 = 深夜時間 - 深夜残業時間
    nightRegularMinutes = Math.max(0, adjustedNightMinutes - nightOvertimeMinutes);
  }

  // 通常残業時間（深夜以外の残業）
  const normalOvertimeMinutes = Math.max(0, overtimeMinutes - nightOvertimeMinutes);

  // 通常時間（残業でも深夜でもない）
  const pureNormalMinutes = Math.max(0, adjustedNormalMinutes - normalOvertimeMinutes);

  // 金額計算
  const hourlyRatePerMinute = hourlyRate / 60;

  // ① ベース給与（全実働時間に対する基本給）
  const basePay = Math.round(workedMinutes * hourlyRatePerMinute);

  // ② 残業手当（8時間超過分 × 0.25）
  const overtimePay = Math.round(overtimeMinutes * hourlyRatePerMinute * 0.25);

  // ③ 深夜手当（深夜時間 × 0.25）
  const nightPay = Math.round(adjustedNightMinutes * hourlyRatePerMinute * 0.25);

  // 合計
  const totalPay = basePay + overtimePay + nightPay;

  // 時間帯別内訳を生成
  const breakdown: TimeBlock[] = [];

  // 通常時間（残業でも深夜でもない）
  if (pureNormalMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + pureNormalMinutes * 60 * 1000),
      hours: pureNormalMinutes / 60,
      type: 'normal',
      rate: 1.0,
      amount: Math.round(pureNormalMinutes * hourlyRatePerMinute)
    });
  }

  // 深夜時間（残業ではない）
  if (nightRegularMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + nightRegularMinutes * 60 * 1000),
      hours: nightRegularMinutes / 60,
      type: 'night',
      rate: 1.25,
      amount: Math.round(nightRegularMinutes * hourlyRatePerMinute * 1.25)
    });
  }

  // 通常残業（深夜ではない残業）
  if (normalOvertimeMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + normalOvertimeMinutes * 60 * 1000),
      hours: normalOvertimeMinutes / 60,
      type: 'overtime',
      rate: 1.25,
      amount: Math.round(normalOvertimeMinutes * hourlyRatePerMinute * 1.25)
    });
  }

  // 深夜残業
  if (nightOvertimeMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + nightOvertimeMinutes * 60 * 1000),
      hours: nightOvertimeMinutes / 60,
      type: 'night_overtime',
      rate: 1.5,
      amount: Math.round(nightOvertimeMinutes * hourlyRatePerMinute * 1.5)
    });
  }

  return {
    basePay,
    overtimePay,
    nightPay,
    totalPay,
    workedMinutes,
    overtimeMinutes,
    nightMinutes: adjustedNightMinutes,
    breakdown
  };
}

/**
 * 分を「X時間Y分」形式に変換
 */
export function formatMinutesToHoursAndMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}分`;
  }
  if (mins === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${mins}分`;
}

/**
 * 金額をフォーマット
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * 差額を計算して表示用にフォーマット
 */
export function formatDifference(original: number, modified: number): string {
  const diff = modified - original;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatCurrency(diff)}`;
}
