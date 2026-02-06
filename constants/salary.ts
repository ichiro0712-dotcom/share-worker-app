/**
 * 給与関連の定数定義
 */

/**
 * 交通費の上限（円）
 * 長時間勤務でも交通費は最大1,000円まで
 */
export const TRANSPORTATION_FEE_MAX = 1000;

export const TRANSPORTATION_FEE_OPTIONS = [
  { value: 0, label: 'なし' },
  ...Array.from({ length: TRANSPORTATION_FEE_MAX / 25 }, (_, i) => ({
    value: (i + 1) * 25,
    label: `${(i + 1) * 25}円`
  }))
] as const;

/**
 * 交通費の最低レート（1時間あたり）
 * 15分25円 = 1時間100円
 */
export const TRANSPORTATION_FEE_MIN_RATE_PER_HOUR = 100;

export const HOURLY_WAGE_MIN = 1000;
export const HOURLY_WAGE_MAX = 5000;
export const HOURLY_WAGE_STEP = 50;
