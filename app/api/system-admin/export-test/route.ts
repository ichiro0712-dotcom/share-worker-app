import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Step 1: 基本レスポンス
    const step1 = 'Basic OK';

    // Step 2: Prismaインポート
    let step2 = 'Not tested';
    try {
      const { prisma } = await import('@/lib/prisma');
      const count = await prisma.attendance.count();
      step2 = `Prisma OK, count=${count}`;
    } catch (e: any) {
      step2 = `Prisma Error: ${e.message}`;
    }

    // Step 3: CSVジェネレーターインポート
    let step3 = 'Not tested';
    try {
      const { generateAttendanceInfoCsv } = await import('@/src/lib/csv-export/attendance-info-csv');
      step3 = `CSV generator OK, type=${typeof generateAttendanceInfoCsv}`;
    } catch (e: any) {
      step3 = `CSV generator Error: ${e.message}`;
    }

    // Step 4: フルクエリ + CSV生成
    let step4 = 'Not tested';
    let csvData = '';
    try {
      const { prisma } = await import('@/lib/prisma');
      const { generateAttendanceInfoCsv } = await import('@/src/lib/csv-export/attendance-info-csv');

      const attendances = await prisma.attendance.findMany({
        where: { status: 'CHECKED_OUT' },
        take: 5,
        include: {
          user: { select: { id: true, name: true } },
          facility: { select: { id: true, facility_name: true } },
          application: {
            include: {
              workDate: {
                include: {
                  job: {
                    select: {
                      id: true, title: true, start_time: true, end_time: true,
                      break_time: true, transportation_fee: true, hourly_wage: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { check_in_time: 'asc' },
      });

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
        job: att.application?.workDate?.job ? {
          id: att.application.workDate.job.id,
          title: att.application.workDate.job.title,
          start_time: att.application.workDate.job.start_time,
          end_time: att.application.workDate.job.end_time,
          break_time: att.application.workDate.job.break_time,
          transportation_fee: att.application.workDate.job.transportation_fee,
          hourly_wage: att.application.workDate.job.hourly_wage,
        } : null,
        facility: { id: att.facility.id, facility_name: att.facility.facility_name },
      }));

      csvData = generateAttendanceInfoCsv(attendanceData);
      step4 = `Full flow OK, rows=${attendances.length}, csvLen=${csvData.length}`;
    } catch (e: any) {
      step4 = `Full flow Error: ${e.message}`;
    }

    return NextResponse.json({
      success: true,
      steps: { step1, step2, step3, step4 },
      csvData: csvData.substring(0, 500) + '...',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
