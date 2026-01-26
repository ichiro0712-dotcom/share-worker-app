/**
 * 案件シフト表(代理)CSV生成
 * CROSSNAVI仕様（18項目）に準拠
 */

import { generateCsv, formatDateForCsv, formatTimeForCsv, calculateWorkingHours } from './utils';
import type { ShiftWithJobAndFacility } from '@/app/system-admin/csv-export/shift-info/types';

/**
 * CROSSNAVI仕様の18項目ヘッダー
 */
const SHIFT_INFO_HEADERS = [
  '取引先ID',           // 1. 必須 - 未対応（CROSSNAVI連携ID）
  '取引先番号',         // 2. 必須 - 未対応（TASTAS管理番号）
  'シフト区分',         // 3. 必須 - 固定「1」（通常）
  '案件 No.',           // 4. 必須 - 空欄
  '取引先案件番号',     // 5. 必須 - 未対応
  '勤務日',             // 6. 必須 - JobWorkDate.work_date
  'シフト名称',         // 7. 必須 - Job.title
  '開始時刻',           // 8. 必須 - Job.start_time
  '終了時刻',           // 9. 必須 - Job.end_time
  '休憩（所定内）',     // 10. 必須 - Job.break_time（分）
  '休憩（所定外）',     // 11. 必須 - 固定「0」
  '休憩（所定内深夜）', // 12. 必須 - 固定「0」
  '休憩（所定外深夜）', // 13. 必須 - 固定「0」
  '実働時間数',         // 14. 必須 - 計算値
  '時間外有無',         // 15. 必須 - 固定「0」
  '時間外単位',         // 16. 必須 - 固定「0:00」
  '時間外単位区分',     // 17. 固定「0」
  '必要人数',           // 18. 必須 - JobWorkDate.recruitment_count
];

/**
 * 案件シフト表CSV生成
 * @param shifts ShiftWithJobAndFacility配列
 * @returns CSV文字列
 */
export function generateShiftInfoCsv(shifts: ShiftWithJobAndFacility[]): string {
  const rows = shifts.map(shift => {
    const job = shift.job;

    // break_timeを数値に変換（文字列の場合がある）
    const breakMinutes = typeof job.break_time === 'string'
      ? parseInt(job.break_time, 10) || 0
      : job.break_time || 0;

    // 時刻をフォーマット
    const startTime = formatTimeForCsv(job.start_time);
    const endTime = formatTimeForCsv(job.end_time);

    // 実働時間計算
    const workingHours = calculateWorkingHours(startTime, endTime, breakMinutes);

    return [
      '', // 1. 取引先ID（未対応）
      '', // 2. 取引先番号（未対応）
      '1', // 3. シフト区分（固定: 通常）
      '', // 4. 案件 No.（空欄）
      '', // 5. 取引先案件番号（未対応）
      formatDateForCsv(shift.work_date), // 6. 勤務日
      job.title, // 7. シフト名称
      startTime, // 8. 開始時刻
      endTime, // 9. 終了時刻
      String(breakMinutes), // 10. 休憩（所定内）分
      '0', // 11. 休憩（所定外）
      '0', // 12. 休憩（所定内深夜）
      '0', // 13. 休憩（所定外深夜）
      workingHours, // 14. 実働時間数
      '0', // 15. 時間外有無（なし）
      '0:00', // 16. 時間外単位
      '0', // 17. 時間外単位区分
      String(shift.recruitment_count), // 18. 必要人数
    ];
  });

  return generateCsv(SHIFT_INFO_HEADERS, rows);
}

/**
 * ヘッダー配列を取得（テスト・検証用）
 */
export function getShiftInfoHeaders(): string[] {
  return [...SHIFT_INFO_HEADERS];
}

/**
 * ヘッダー数を取得
 */
export function getShiftInfoHeaderCount(): number {
  return SHIFT_INFO_HEADERS.length;
}
