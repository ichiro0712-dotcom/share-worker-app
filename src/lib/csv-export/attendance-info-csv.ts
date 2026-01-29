/**
 * 勤怠情報CSV生成
 * CROSSNAVI仕様（35項目）に準拠
 * 深夜勤務（22:00-05:00）、時間外勤務（8h超）の計算対応
 */

import { generateCsv, formatDateForCsv, formatTimeForCsv, calculateWorkingHours, formatMinutesToTime } from './utils';
import { calculateSalary } from '@/src/lib/salary-calculator';
import type { AttendanceWithDetails } from '@/app/system-admin/csv-export/attendance-info/types';

/**
 * CROSSNAVI仕様の36項目ヘッダー（35項目 + ワーカー名）
 */
const ATTENDANCE_INFO_HEADERS = [
  '就業者ID',               // 1. User.id
  '雇用契約No.',            // 2. 必須 - 空白で出力
  '勤務日',                 // 3. 必須 - check_in_time の日付
  '出勤区分',               // 4. 0=出勤
  'シフト名称',             // 5. Job.title
  '所定開始時間',           // 6. Job.start_time
  '所定終了時間',           // 7. Job.end_time
  '所定時間数',             // 8. 計算値
  '所定休憩(所定内)',       // 9. Job.break_time
  '所定休憩(所定外)',       // 10. 0
  '所定休憩(所定内深夜)',   // 11. 0
  '所定休憩(所定外深夜)',   // 12. 0
  '時間外有無',             // 13. 0
  '時間外単位区分',         // 14. 0
  '時間外単位',             // 15. 0:00
  '開始時間',               // 16. 実績開始
  '終了時間',               // 17. 実績終了
  '総休憩時間',             // 18. 実績休憩
  '休憩(所定内)',           // 19. 実績休憩
  '休憩(所定外)',           // 20. 0
  '休憩(所定内深夜)',       // 21. 0
  '休憩(所定外深夜)',       // 22. 0
  '実働時間数',             // 23. 計算値
  '所定内勤務時間',         // 24. 計算値
  '所定外勤務時間',         // 25. 0:00
  '深夜勤務時間',           // 26. 0:00
  '所定外深夜勤務時間',     // 27. 0:00
  '45時間超え',             // 28. 0:00
  '60時間超え',             // 29. 0:00
  '45時間超え深夜',         // 30. 0:00
  '60時間超え深夜',         // 31. 0:00
  '休日出勤勤務時間',       // 32. 0:00
  '遅刻時間',               // 33. 計算値
  '早退時間',               // 34. 計算値
  '交通費金額',             // 35. Job.transportation_fee
  'ワーカー名',             // 36. User.name（追加項目）
];

/**
 * DateTimeからhh:mm形式に変換
 */
function formatDateTimeToTime(datetime: Date | null): string {
  if (!datetime) return '';
  const d = new Date(datetime);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 遅刻時間を計算（分）
 */
function calculateLateTime(scheduledStart: string, actualStart: Date | null): string {
  if (!actualStart || !scheduledStart) return '0:00';

  const [schedH, schedM] = scheduledStart.split(':').map(Number);
  const actual = new Date(actualStart);
  const actualH = actual.getHours();
  const actualM = actual.getMinutes();

  const diff = (actualH * 60 + actualM) - (schedH * 60 + schedM);
  if (diff <= 0) return '0:00';

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 早退時間を計算（分）
 */
function calculateEarlyLeaveTime(scheduledEnd: string, actualEnd: Date | null): string {
  if (!actualEnd || !scheduledEnd) return '0:00';

  const [schedH, schedM] = scheduledEnd.split(':').map(Number);
  const actual = new Date(actualEnd);
  const actualH = actual.getHours();
  const actualM = actual.getMinutes();

  const diff = (schedH * 60 + schedM) - (actualH * 60 + actualM);
  if (diff <= 0) return '0:00';

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 勤怠情報CSV生成
 * @param attendances AttendanceWithDetails配列
 * @returns CSV文字列
 */
export function generateAttendanceInfoCsv(attendances: AttendanceWithDetails[]): string {
  const rows = attendances.map(att => {
    const job = att.job;
    const startTime = job ? formatTimeForCsv(job.start_time) : '';
    const endTime = job ? formatTimeForCsv(job.end_time) : '';
    const breakMinutes = job?.break_time ? parseInt(job.break_time, 10) || 0 : 0;

    // 所定時間数
    const scheduledHours = startTime && endTime
      ? calculateWorkingHours(startTime, endTime, breakMinutes)
      : '00:00';

    // 実績開始・終了
    const actualStart = att.actual_start_time || att.check_in_time;
    const actualEnd = att.actual_end_time || att.check_out_time;
    const actualStartTime = formatDateTimeToTime(actualStart);
    const actualEndTime = formatDateTimeToTime(actualEnd);
    const actualBreak = att.actual_break_time ?? breakMinutes;

    // 実働時間
    const actualHours = actualStartTime && actualEndTime
      ? calculateWorkingHours(actualStartTime, actualEndTime, actualBreak)
      : '00:00';

    // 遅刻・早退
    const lateTime = calculateLateTime(startTime, actualStart);
    const earlyLeaveTime = calculateEarlyLeaveTime(endTime, actualEnd);

    // 深夜・残業時間の計算（時給情報が必要）
    let overtimeMinutes = 0;
    let nightMinutes = 0;
    let normalMinutes = 0;
    let hasOvertime = false;

    // 実績がある場合のみ深夜・残業計算
    if (actualStart && actualEnd && job?.hourly_wage) {
      try {
        const salaryResult = calculateSalary({
          startTime: new Date(actualStart),
          endTime: new Date(actualEnd),
          breakMinutes: actualBreak,
          hourlyRate: job.hourly_wage,
        });
        overtimeMinutes = salaryResult.overtimeMinutes;
        nightMinutes = salaryResult.nightMinutes;
        normalMinutes = salaryResult.workedMinutes - overtimeMinutes;
        hasOvertime = overtimeMinutes > 0;
      } catch (error) {
        // 計算エラー時は0で出力
        console.error('[generateAttendanceInfoCsv] Salary calculation error:', error);
      }
    }

    return [
      String(att.user_id), // 1. 就業者ID
      '', // 2. 雇用契約No.（空白で出力）
      formatDateForCsv(att.check_in_time), // 3. 勤務日
      '0', // 4. 出勤区分（0=出勤）
      job?.title || '', // 5. シフト名称
      startTime, // 6. 所定開始時間
      endTime, // 7. 所定終了時間
      scheduledHours, // 8. 所定時間数
      String(breakMinutes), // 9. 所定休憩(所定内)
      '0', // 10. 所定休憩(所定外)
      '0', // 11. 所定休憩(所定内深夜)
      '0', // 12. 所定休憩(所定外深夜)
      hasOvertime ? '1' : '0', // 13. 時間外有無
      '0', // 14. 時間外単位区分
      '0:00', // 15. 時間外単位
      actualStartTime, // 16. 開始時間（実績）
      actualEndTime, // 17. 終了時間（実績）
      String(actualBreak), // 18. 総休憩時間
      String(actualBreak), // 19. 休憩(所定内)
      '0', // 20. 休憩(所定外)
      '0', // 21. 休憩(所定内深夜)
      '0', // 22. 休憩(所定外深夜)
      actualHours, // 23. 実働時間数
      formatMinutesToTime(normalMinutes), // 24. 所定内勤務時間
      formatMinutesToTime(overtimeMinutes), // 25. 所定外勤務時間
      formatMinutesToTime(nightMinutes), // 26. 深夜勤務時間
      '0:00', // 27. 所定外深夜勤務時間（深夜残業は26に含む）
      '0:00', // 28. 45時間超え
      '0:00', // 29. 60時間超え
      '0:00', // 30. 45時間超え深夜
      '0:00', // 31. 60時間超え深夜
      '0:00', // 32. 休日出勤勤務時間
      lateTime, // 33. 遅刻時間
      earlyLeaveTime, // 34. 早退時間
      job?.transportation_fee ? String(job.transportation_fee) : '0', // 35. 交通費金額
      att.user.name, // 36. ワーカー名（追加項目）
    ];
  });

  return generateCsv(ATTENDANCE_INFO_HEADERS, rows);
}

/**
 * ヘッダー配列を取得（テスト・検証用）
 */
export function getAttendanceInfoHeaders(): string[] {
  return [...ATTENDANCE_INFO_HEADERS];
}

/**
 * ヘッダー数を取得
 */
export function getAttendanceInfoHeaderCount(): number {
  return ATTENDANCE_INFO_HEADERS.length;
}
