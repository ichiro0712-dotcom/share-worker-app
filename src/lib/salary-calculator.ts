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
 *
 * 休憩時間の控除ルール:
 * 最も単価の高い時間帯から優先的に控除
 * 1. 深夜残業（1.5倍）から最優先で控除
 * 2. 残業のみ or 深夜のみ（1.25倍）から控除
 * 3. 通常時間（1.0倍）から最後に控除
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const { startTime, endTime, breakMinutes, hourlyRate } = input;

  // 総拘束時間（分）
  const totalMinutes = getMinutesBetween(startTime, endTime);

  // 実働時間（分）
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

  // 時間帯ごとにセグメント分割
  const segments = splitWorkPeriodIntoSegments(startTime, endTime);

  // 各セグメントに累積時間と種別を付与
  interface TypedSegment {
    start: Date;
    end: Date;
    minutes: number;
    isNight: boolean;
    isOvertime: boolean;
    type: 'normal' | 'night' | 'overtime' | 'night_overtime';
  }

  const typedSegments: TypedSegment[] = [];
  let accumulatedMinutes = 0;

  for (const segment of segments) {
    const segmentMinutes = getMinutesBetween(segment.start, segment.end);
    const segmentStartAcc = accumulatedMinutes;
    const segmentEndAcc = accumulatedMinutes + segmentMinutes;

    // セグメント内で8時間閾値をまたぐ場合は分割
    if (segmentStartAcc < OVERTIME_THRESHOLD_MINUTES && segmentEndAcc > OVERTIME_THRESHOLD_MINUTES) {
      // 閾値前の部分（残業なし）
      const beforeThreshold = OVERTIME_THRESHOLD_MINUTES - segmentStartAcc;
      typedSegments.push({
        start: segment.start,
        end: new Date(segment.start.getTime() + beforeThreshold * 60 * 1000),
        minutes: beforeThreshold,
        isNight: segment.isNight,
        isOvertime: false,
        type: segment.isNight ? 'night' : 'normal'
      });

      // 閾値後の部分（残業あり）
      const afterThreshold = segmentEndAcc - OVERTIME_THRESHOLD_MINUTES;
      typedSegments.push({
        start: new Date(segment.start.getTime() + beforeThreshold * 60 * 1000),
        end: segment.end,
        minutes: afterThreshold,
        isNight: segment.isNight,
        isOvertime: true,
        type: segment.isNight ? 'night_overtime' : 'overtime'
      });
    } else {
      // 分割不要
      const isOvertime = segmentStartAcc >= OVERTIME_THRESHOLD_MINUTES;
      let type: 'normal' | 'night' | 'overtime' | 'night_overtime';
      if (segment.isNight && isOvertime) {
        type = 'night_overtime';
      } else if (segment.isNight) {
        type = 'night';
      } else if (isOvertime) {
        type = 'overtime';
      } else {
        type = 'normal';
      }

      typedSegments.push({
        start: segment.start,
        end: segment.end,
        minutes: segmentMinutes,
        isNight: segment.isNight,
        isOvertime,
        type
      });
    }

    accumulatedMinutes = segmentEndAcc;
  }

  // 各タイプの時間を集計（休憩控除前）
  let nightOvertimeMinutes = 0;  // 深夜残業（1.5倍）
  let overtimeMinutes = 0;       // 残業のみ（1.25倍）
  let nightMinutes = 0;          // 深夜のみ（1.25倍）
  let normalMinutes = 0;         // 通常（1.0倍）

  for (const seg of typedSegments) {
    switch (seg.type) {
      case 'night_overtime':
        nightOvertimeMinutes += seg.minutes;
        break;
      case 'overtime':
        overtimeMinutes += seg.minutes;
        break;
      case 'night':
        nightMinutes += seg.minutes;
        break;
      case 'normal':
        normalMinutes += seg.minutes;
        break;
    }
  }

  // 休憩時間を単価の高い順に控除
  // 優先順位: 深夜残業(1.5) > 残業(1.25) = 深夜(1.25) > 通常(1.0)
  // 同じ倍率の場合は残業から先に控除（後半の時間に休憩を取る想定）
  let remainingBreak = breakMinutes;

  // 1. 深夜残業から控除
  if (remainingBreak > 0 && nightOvertimeMinutes > 0) {
    const deduct = Math.min(remainingBreak, nightOvertimeMinutes);
    nightOvertimeMinutes -= deduct;
    remainingBreak -= deduct;
  }

  // 2. 残業（深夜以外）から控除
  if (remainingBreak > 0 && overtimeMinutes > 0) {
    const deduct = Math.min(remainingBreak, overtimeMinutes);
    overtimeMinutes -= deduct;
    remainingBreak -= deduct;
  }

  // 3. 深夜（残業以外）から控除
  if (remainingBreak > 0 && nightMinutes > 0) {
    const deduct = Math.min(remainingBreak, nightMinutes);
    nightMinutes -= deduct;
    remainingBreak -= deduct;
  }

  // 4. 通常時間から控除
  if (remainingBreak > 0 && normalMinutes > 0) {
    const deduct = Math.min(remainingBreak, normalMinutes);
    normalMinutes -= deduct;
    remainingBreak -= deduct;
  }

  // 休憩控除後の各カテゴリ時間
  const adjustedNightOvertimeMinutes = nightOvertimeMinutes;
  const adjustedOvertimeMinutes = overtimeMinutes;
  const adjustedNightMinutes = nightMinutes;
  const adjustedNormalMinutes = normalMinutes;

  // 合計の残業時間（深夜残業 + 通常残業）
  const totalOvertimeMinutes = adjustedNightOvertimeMinutes + adjustedOvertimeMinutes;

  // 合計の深夜時間（深夜残業 + 深夜通常）
  const totalNightMinutes = adjustedNightOvertimeMinutes + adjustedNightMinutes;

  // 金額計算
  const hourlyRatePerMinute = hourlyRate / 60;

  // ① ベース給与（全実働時間に対する基本給）
  const basePay = Math.round(workedMinutes * hourlyRatePerMinute);

  // ② 残業手当（残業時間 × 0.25）
  const overtimePay = Math.round(totalOvertimeMinutes * hourlyRatePerMinute * 0.25);

  // ③ 深夜手当（深夜時間 × 0.25）
  const nightPay = Math.round(totalNightMinutes * hourlyRatePerMinute * 0.25);

  // 合計
  const totalPay = basePay + overtimePay + nightPay;

  // 時間帯別内訳を生成
  const breakdown: TimeBlock[] = [];

  // 通常時間（残業でも深夜でもない）
  if (adjustedNormalMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + adjustedNormalMinutes * 60 * 1000),
      hours: adjustedNormalMinutes / 60,
      type: 'normal',
      rate: 1.0,
      amount: Math.round(adjustedNormalMinutes * hourlyRatePerMinute)
    });
  }

  // 深夜時間（残業ではない）
  if (adjustedNightMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + adjustedNightMinutes * 60 * 1000),
      hours: adjustedNightMinutes / 60,
      type: 'night',
      rate: 1.25,
      amount: Math.round(adjustedNightMinutes * hourlyRatePerMinute * 1.25)
    });
  }

  // 通常残業（深夜ではない残業）
  if (adjustedOvertimeMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + adjustedOvertimeMinutes * 60 * 1000),
      hours: adjustedOvertimeMinutes / 60,
      type: 'overtime',
      rate: 1.25,
      amount: Math.round(adjustedOvertimeMinutes * hourlyRatePerMinute * 1.25)
    });
  }

  // 深夜残業
  if (adjustedNightOvertimeMinutes > 0) {
    breakdown.push({
      startTime: new Date(startTime),
      endTime: new Date(startTime.getTime() + adjustedNightOvertimeMinutes * 60 * 1000),
      hours: adjustedNightOvertimeMinutes / 60,
      type: 'night_overtime',
      rate: 1.5,
      amount: Math.round(adjustedNightOvertimeMinutes * hourlyRatePerMinute * 1.5)
    });
  }

  return {
    basePay,
    overtimePay,
    nightPay,
    totalPay,
    workedMinutes,
    overtimeMinutes: totalOvertimeMinutes,
    nightMinutes: totalNightMinutes,
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
