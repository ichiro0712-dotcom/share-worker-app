/**
 * 給与計算関連のユーティリティ関数
 */

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
 * 日給を計算する
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

  // 総勤務時間（分）を計算
  let totalMinutes = endMinutes - startMinutes;

  // 日をまたぐ場合の調整（翌プレフィックスがない旧データ対応）
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  // 休憩時間を引く
  totalMinutes -= breakTime;

  // 時間に変換
  const hours = totalMinutes / 60;

  // 日給 = (時給 × 実働時間) + 交通費（端数切り上げ）
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
