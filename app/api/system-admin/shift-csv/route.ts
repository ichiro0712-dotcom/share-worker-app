import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatDateForCsv, formatTimeForCsv, calculateWorkingHours } from '@/src/lib/csv-export/utils';

export const dynamic = 'force-dynamic';

// CROSSNAVI仕様の18項目ヘッダー
const HEADERS = [
  '取引先ID',
  '取引先番号',
  'シフト区分',
  '案件 No.',
  '取引先案件番号',
  '勤務日',
  'シフト名称',
  '開始時刻',
  '終了時刻',
  '休憩（所定内）',
  '休憩（所定外）',
  '休憩（所定内深夜）',
  '休憩（所定外深夜）',
  '実働時間数',
  '時間外有無',
  '時間外単位',
  '時間外単位区分',
  '必要人数',
];

const BATCH_SIZE = 100;

function escapeField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeField).join(',') + '\r\n';
}

function shiftToRow(shift: any): (string | number)[] {
  const job = shift.job;
  const breakMinutes = typeof job.break_time === 'string' ? parseInt(job.break_time, 10) || 0 : job.break_time || 0;
  const startTime = formatTimeForCsv(job.start_time);
  const endTime = formatTimeForCsv(job.end_time);
  const workingHours = calculateWorkingHours(startTime, endTime, breakMinutes);

  return [
    '',
    '',
    '1',
    '',
    '',
    formatDateForCsv(shift.work_date),
    job.title,
    startTime,
    endTime,
    breakMinutes,
    '0',
    '0',
    '0',
    workingHours,
    '0',
    '0:00',
    '0',
    shift.recruitment_count,
  ];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const jobTitle = url.searchParams.get('jobTitle');
  const facilityName = url.searchParams.get('facilityName');
  const workDateFrom = url.searchParams.get('workDateFrom');
  const workDateTo = url.searchParams.get('workDateTo');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  const where: any = {};
  if (search) {
    where.OR = [
      { job: { title: { contains: search } } },
      { job: { facility: { facility_name: { contains: search } } } },
    ];
  }
  if (jobTitle) where.job = { ...where.job, title: { contains: jobTitle } };
  if (facilityName) where.job = { ...where.job, facility: { facility_name: { contains: facilityName } } };
  if (workDateFrom || workDateTo) {
    where.work_date = {};
    if (workDateFrom) where.work_date.gte = new Date(workDateFrom);
    if (workDateTo) where.work_date.lte = new Date(workDateTo);
  }
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom) where.created_at.gte = new Date(dateFrom);
    if (dateTo) where.created_at.lte = new Date(dateTo);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF' + formatRow(HEADERS)));

        const totalCount = await prisma.jobWorkDate.count({ where });
        let processed = 0;

        while (processed < totalCount) {
          const batch = await prisma.jobWorkDate.findMany({
            where,
            include: {
              job: {
                include: { facility: true },
              },
            },
            orderBy: { work_date: 'asc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          for (const shift of batch) {
            controller.enqueue(encoder.encode(formatRow(shiftToRow(shift))));
          }

          processed += batch.length;
        }

        controller.close();
      } catch (error) {
        console.error('[shift-csv] Stream error:', error);
        controller.error(error);
      }
    },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`案件シフト表_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}
