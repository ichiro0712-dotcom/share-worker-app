/**
 * 給与関連の定数定義
 */

export const TRANSPORTATION_FEE_OPTIONS = [
  { value: 0, label: 'なし' },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: (i + 1) * 100,
    label: `${(i + 1) * 100}円`
  }))
] as const;

export const HOURLY_WAGE_MIN = 1000;
export const HOURLY_WAGE_MAX = 5000;
export const HOURLY_WAGE_STEP = 50;
