import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  formatDateForCsv,
  formatTimeForCsv,
  calculateWorkingHours,
  formatMinutesToTime,
} from '@/src/lib/csv-export/utils';
import { calculateSalary } from '@/src/lib/salary-calculator';

export const dynamic = 'force-dynamic';

// CROSSNAVI仕様の36項目ヘッダー
const HEADERS = [
  '就業者ID',
  '雇用契約No.',
  '勤務日',
  '出勤区分',
  'シフト名称',
  '所定開始時間',
  '所定終了時間',
  '所定時間数',
  '所定休憩(所定内)',
  '所定休憩(所定外)',
  '所定休憩(所定内深夜)',
  '所定休憩(所定外深夜)',
  '時間外有無',
  '時間外単位区分',
  '時間外単位',
  '開始時間',
  '終了時間',
  '総休憩時間',
  '休憩(所定内)',
  '休憩(所定外)',
  '休憩(所定内深夜)',
  '休憩(所定外深夜)',
  '実働時間数',
  '所定内勤務時間',
  '所定外勤務時間',
  '深夜勤務時間',
  '所定外深夜勤務時間',
  '45時間超え',
  '60時間超え',
  '45時間超え深夜',
  '60時間超え深夜',
  '休日出勤勤務時間',
  '遅刻時間',
  '早退時間',
  '交通費金額',
  'ワーカー名',
];

const BATCH_SIZE = 100;

/**
 * CSVフィールドをエスケープ
 */
function escapeField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 行を CSV 形式に変換
 */
function formatRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeField).join(',') + '\r\n';
}

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
 * 遅刻時間を計算
 */
function calculateLateTime(scheduledStart: string, actualStart: Date | null): string {
  if (!actualStart || !scheduledStart) return '0:00';
  const [schedH, schedM] = scheduledStart.split(':').map(Number);
  const actual = new Date(actualStart);
  const diff = (actual.getHours() * 60 + actual.getMinutes()) - (schedH * 60 + schedM);
  if (diff <= 0) return '0:00';
  return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
}

/**
 * 早退時間を計算
 */
function calculateEarlyLeaveTime(scheduledEnd: string, actualEnd: Date | null): string {
  if (!actualEnd || !scheduledEnd) return '0:00';
  const [schedH, schedM] = scheduledEnd.split(':').map(Number);
  const actual = new Date(actualEnd);
  const diff = (schedH * 60 + schedM) - (actual.getHours() * 60 + actual.getMinutes());
  if (diff <= 0) return '0:00';
  return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
}

/**
 * 1件の勤怠データを CSV 行に変換
 */
function attendanceToRow(att: any): (string | number)[] {
  const job = att.application?.workDate?.job;
  const startTime = job ? formatTimeForCsv(job.start_time) : '';
  const endTime = job ? formatTimeForCsv(job.end_time) : '';
  const breakMinutes = job?.break_time ? parseInt(job.break_time, 10) || 0 : 0;

  const scheduledHours =
    startTime && endTime ? calculateWorkingHours(startTime, endTime, breakMinutes) : '00:00';

  const actualStart = att.actual_start_time || att.check_in_time;
  const actualEnd = att.actual_end_time || att.check_out_time;
  const actualStartTime = formatDateTimeToTime(actualStart);
  const actualEndTime = formatDateTimeToTime(actualEnd);
  const actualBreak = att.actual_break_time ?? breakMinutes;

  const actualHours =
    actualStartTime && actualEndTime
      ? calculateWorkingHours(actualStartTime, actualEndTime, actualBreak)
      : '00:00';

  const lateTime = calculateLateTime(startTime, actualStart);
  const earlyLeaveTime = calculateEarlyLeaveTime(endTime, actualEnd);

  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let normalMinutes = 0;
  let hasOvertime = false;

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
    } catch {
      // ignore calculation errors
    }
  }

  return [
    att.user_id,
    '',
    formatDateForCsv(att.check_in_time),
    '0',
    job?.title || '',
    startTime,
    endTime,
    scheduledHours,
    breakMinutes,
    '0',
    '0',
    '0',
    hasOvertime ? '1' : '0',
    '0',
    '0:00',
    actualStartTime,
    actualEndTime,
    actualBreak,
    actualBreak,
    '0',
    '0',
    '0',
    actualHours,
    formatMinutesToTime(normalMinutes),
    formatMinutesToTime(overtimeMinutes),
    formatMinutesToTime(nightMinutes),
    '0:00',
    '0:00',
    '0:00',
    '0:00',
    '0:00',
    '0:00',
    lateTime,
    earlyLeaveTime,
    job?.transportation_fee ?? 0,
    att.user?.name || '',
  ];
}

/**
 * ストリーミングCSVエクスポート
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // 未指定の場合は全件
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const facilityName = url.searchParams.get('facilityName');
  const corporationName = url.searchParams.get('corporationName');
  const workerSearch = url.searchParams.get('workerSearch');

  // WHERE 条件を構築
  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    where.check_in_time = {};
    if (dateFrom) where.check_in_time.gte = new Date(dateFrom);
    if (dateTo) where.check_in_time.lte = new Date(dateTo);
  }
  if (facilityName) {
    where.facility = { facility_name: { contains: facilityName } };
  }
  if (corporationName) {
    where.facility = {
      ...where.facility,
      corporation: { name: { contains: corporationName } },
    };
  }
  if (workerSearch) {
    where.user = {
      OR: [{ name: { contains: workerSearch } }, { email: { contains: workerSearch } }],
    };
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // BOM + ヘッダー行を送信
        controller.enqueue(encoder.encode('\uFEFF' + formatRow(HEADERS)));

        // 総件数を取得してバッチ処理
        const totalCount = await prisma.attendance.count({ where });
        let processed = 0;

        while (processed < totalCount) {
          const batch = await prisma.attendance.findMany({
            where,
            include: {
              user: { select: { id: true, name: true } },
              facility: { select: { id: true, facility_name: true } },
              application: {
                include: {
                  workDate: {
                    include: {
                      job: {
                        select: {
                          id: true,
                          title: true,
                          start_time: true,
                          end_time: true,
                          break_time: true,
                          transportation_fee: true,
                          hourly_wage: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { check_in_time: 'asc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          // バッチ内の各行を即座に送信
          for (const att of batch) {
            const row = attendanceToRow(att);
            controller.enqueue(encoder.encode(formatRow(row)));
          }

          processed += batch.length;
        }

        controller.close();
      } catch (error) {
        console.error('[attendance-csv] Stream error:', error);
        controller.error(error);
      }
    },
  });

  // ファイル名を生成
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`勤怠情報_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
