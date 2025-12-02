/**
 * 時間関連の定数定義
 */

// 時間選択用（0〜23時）
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: `${i}時`,
}));

// 分選択用（00, 15, 30, 45）
export const MINUTE_OPTIONS = [
  { value: '00', label: '00分' },
  { value: '15', label: '15分' },
  { value: '30', label: '30分' },
  { value: '45', label: '45分' },
] as const;

export const BREAK_TIME_OPTIONS = [
  { value: 0, label: 'なし' },
  { value: 10, label: '10分' },
  { value: 15, label: '15分' },
  { value: 20, label: '20分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
  { value: 90, label: '90分' },
  { value: 120, label: '120分' },
] as const;

export const RECRUITMENT_START_DAY_OPTIONS = [
  { value: 0, label: '公開時' },
  { value: -1, label: '勤務当日' },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: -(i + 2),
    label: `勤務${i + 1}日前`
  })),
] as const;

export const RECRUITMENT_END_DAY_OPTIONS = [
  { value: 0, label: '勤務開始時' },
  { value: -1, label: '勤務当日' },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: -(i + 2),
    label: `勤務${i + 1}日前`
  })),
] as const;
