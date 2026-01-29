import { NextRequest, NextResponse } from 'next/server';

// 動的ルート設定
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Step 1: 基本レスポンステスト
    const step1 = 'Basic response OK';

    // Step 2: URL解析
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'CHECKED_OUT';
    const step2 = `URL parsed, status=${status}`;

    // Step 3: Prismaインポート
    let step3 = 'Prisma not imported';
    let prisma: any;
    try {
      const module = await import('@/lib/prisma');
      prisma = module.prisma;
      step3 = 'Prisma imported OK';
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Prisma import failed: ${e.message}` });
    }

    // Step 4: CSVジェネレーターインポート
    let step4 = 'CSV generator not imported';
    let generateAttendanceInfoCsv: any;
    try {
      const csvModule = await import('@/src/lib/csv-export/attendance-info-csv');
      generateAttendanceInfoCsv = csvModule.generateAttendanceInfoCsv;
      step4 = 'CSV generator imported OK';
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `CSV generator import failed: ${e.message}`, steps: { step1, step2, step3 } });
    }

    // Step 5: データベースクエリ
    let step5 = 'DB query not executed';
    let attendances: any[];
    try {
      attendances = await prisma.attendance.findMany({
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
      step5 = `DB query OK, count=${attendances.length}`;
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `DB query failed: ${e.message}`, steps: { step1, step2, step3, step4 } });
    }

    // Step 6: データ変換
    let step6 = 'Data transform not executed';
    let attendanceData: any[];
    try {
      attendanceData = attendances.map((att: any) => ({
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
      step6 = 'Data transform OK';
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Data transform failed: ${e.message}`, steps: { step1, step2, step3, step4, step5 } });
    }

    // Step 7: CSV生成
    let step7 = 'CSV generation not executed';
    let csvData: string;
    try {
      csvData = generateAttendanceInfoCsv(attendanceData);
      step7 = `CSV generation OK, length=${csvData.length}`;
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `CSV generation failed: ${e.message}`, steps: { step1, step2, step3, step4, step5, step6 } });
    }

    return NextResponse.json({
      success: true,
      csvData,
      count: attendances.length,
      steps: { step1, step2, step3, step4, step5, step6, step7 },
    });
  } catch (error) {
    console.error('[attendance-export] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
