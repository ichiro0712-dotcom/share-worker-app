import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAttendanceInfoCsv } from '@/src/lib/csv-export/attendance-info-csv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'CHECKED_OUT';

    // データベースからの勤怠データ取得
    const attendances = await prisma.attendance.findMany({
      where: { status },
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
    });

    // CSV生成用にデータを変換
    const attendanceData = attendances.map((att) => ({
      id: att.id,
      user_id: att.user_id,
      check_in_time: att.check_in_time,
      check_out_time: att.check_out_time,
      actual_start_time: att.actual_start_time,
      actual_end_time: att.actual_end_time,
      actual_break_time: att.actual_break_time,
      status: att.status,
      user: { id: att.user.id, name: att.user.name },
      job: att.application?.workDate?.job
        ? {
            id: att.application.workDate.job.id,
            title: att.application.workDate.job.title,
            start_time: att.application.workDate.job.start_time,
            end_time: att.application.workDate.job.end_time,
            break_time: att.application.workDate.job.break_time,
            transportation_fee: att.application.workDate.job.transportation_fee,
            hourly_wage: att.application.workDate.job.hourly_wage,
          }
        : null,
      facility: { id: att.facility.id, facility_name: att.facility.facility_name },
    }));

    // CSV生成
    const csvData = generateAttendanceInfoCsv(attendanceData);

    return NextResponse.json({
      success: true,
      csvData,
      count: attendances.length,
    });
  } catch (error) {
    console.error('[attendance-csv] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
