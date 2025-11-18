/**
 * 給与計算関連のユーティリティ関数
 */

/**
 * 日給を計算する
 * @param startTime - 勤務開始時刻 (HH:mm 形式)
 * @param endTime - 勤務終了時刻 (HH:mm 形式)
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
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  // 総勤務時間（分）を計算
  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

  // 日をまたぐ場合の調整
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  // 休憩時間を引く
  totalMinutes -= breakTime;

  // 時間に変換
  const hours = totalMinutes / 60;

  // 日給 = (時給 × 実働時間) + 交通費
  return Math.floor(hours * hourlyWage + transportationFee);
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
  return Math.floor(hourlyWage * hoursPerDay * daysPerMonth);
};

/**
 * 勤務時間から実働時間を計算
 * @param startTime - 勤務開始時刻 (HH:mm 形式)
 * @param endTime - 勤務終了時刻 (HH:mm 形式)
 * @param breakTime - 休憩時間（分）
 * @returns 実働時間（時間）
 */
export const calculateWorkingHours = (
  startTime: string,
  endTime: string,
  breakTime: number
): number => {
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  totalMinutes -= breakTime;

  return totalMinutes / 60;
};
