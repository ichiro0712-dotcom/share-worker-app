import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAttendanceInfoCsv } from '@/src/lib/csv-export/attendance-info-csv';

export const dynamic = 'force-dynamic';

// GET と POST の両方をサポート
export async function GET(request: NextRequest) {
  return handleExport(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleExport(request, 'POST');
}

async function handleExport(request: NextRequest, method: string) {
  try {
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    let facilityId: number | null = null;
    let facilityName: string | null = null;
    let corporationName: string | null = null;
    let workerSearch: string | null = null;
    let status: string | null = null;

    if (method === 'GET') {
      const { searchParams } = new URL(request.url);
      dateFrom = searchParams.get('dateFrom');
      dateTo = searchParams.get('dateTo');
      facilityId = searchParams.get('facilityId') ? parseInt(searchParams.get('facilityId')!) : null;
      facilityName = searchParams.get('facilityName');
      corporationName = searchParams.get('corporationName');
      workerSearch = searchParams.get('workerSearch');
      status = searchParams.get('status');
    } else {
      const body = await request.json();
      dateFrom = body.dateFrom;
      dateTo = body.dateTo;
      facilityId = body.facilityId;
      facilityName = body.facilityName;
      corporationName = body.corporationName;
      workerSearch = body.workerSearch;
      status = body.status;
    }

    const whereClause: any = {};

    // 期間フィルター
    if (dateFrom || dateTo) {
      whereClause.check_in_time = {};
      if (dateFrom) {
        whereClause.check_in_time.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.check_in_time.lte = new Date(dateTo);
      }
    }

    // ステータスフィルター（指定がなければ退勤済みのみ）
    whereClause.status = status as string || 'CHECKED_OUT';

    if (facilityId) {
      whereClause.facility_id = facilityId;
    }

    // 施設名フィルター
    if (facilityName) {
      whereClause.facility = {
        ...whereClause.facility,
        facility_name: { contains: facilityName, mode: 'insensitive' },
      };
    }

    // 法人名フィルター
    if (corporationName) {
      whereClause.facility = {
        ...whereClause.facility,
        corporation_name: { contains: corporationName, mode: 'insensitive' },
      };
    }

    // ワーカー検索フィルター
    if (workerSearch) {
      whereClause.user = {
        OR: [
          { name: { contains: workerSearch, mode: 'insensitive' } },
          { email: { contains: workerSearch, mode: 'insensitive' } },
        ],
      };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        facility: {
          select: {
            id: true,
            facility_name: true,
          },
        },
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
      orderBy: {
        check_in_time: 'asc',
      },
    });

    // CROSSNAVI連携用データ形式に変換
    const attendanceData = attendances.map((att) => ({
      id: att.id,
      user_id: att.user_id,
      check_in_time: att.check_in_time,
      check_out_time: att.check_out_time,
      actual_start_time: att.actual_start_time,
      actual_end_time: att.actual_end_time,
      actual_break_time: att.actual_break_time,
      status: att.status,
      user: {
        id: att.user.id,
        name: att.user.name,
      },
      job: att.application?.workDate.job ? {
        id: att.application.workDate.job.id,
        title: att.application.workDate.job.title,
        start_time: att.application.workDate.job.start_time,
        end_time: att.application.workDate.job.end_time,
        break_time: att.application.workDate.job.break_time,
        transportation_fee: att.application.workDate.job.transportation_fee,
        hourly_wage: att.application.workDate.job.hourly_wage,
      } : null,
      facility: {
        id: att.facility.id,
        facility_name: att.facility.facility_name,
      },
    }));

    // CSV生成
    const csvData = generateAttendanceInfoCsv(attendanceData);

    return NextResponse.json({
      success: true,
      csvData,
      count: attendances.length,
    });
  } catch (error) {
    console.error('[attendance-export] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'エクスポートに失敗しました',
      },
      { status: 500 }
    );
  }
}
