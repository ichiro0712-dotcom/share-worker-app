import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { WorkerStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 施設管理者の認証チェック
    const cookieStore = cookies();
    const adminCookie = cookieStore.get('admin_session');

    if (!adminCookie) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const workerId = parseInt(params.id);

    if (isNaN(workerId)) {
      return NextResponse.json(
        { error: '無効なワーカーIDです' },
        { status: 400 }
      );
    }

    // ワーカー情報を取得
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { error: 'ワーカーが見つかりません' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今後の勤務予定を取得（SCHEDULED, WORKING状態）
    const upcomingApplications = await prisma.application.findMany({
      where: {
        user_id: workerId,
        status: { in: [WorkerStatus.SCHEDULED, WorkerStatus.WORKING, WorkerStatus.APPLIED] },
        workDate: {
          work_date: { gte: today },
        },
      },
      include: {
        workDate: {
          include: {
            job: {
              include: {
                facility: true,
              },
            },
          },
        },
      },
      orderBy: {
        workDate: {
          work_date: 'asc',
        },
      },
      take: 30,
    });

    // 過去の勤務履歴を取得（COMPLETED系ステータス）
    const pastApplications = await prisma.application.findMany({
      where: {
        user_id: workerId,
        status: { in: [WorkerStatus.COMPLETED_PENDING, WorkerStatus.COMPLETED_RATED] },
        workDate: {
          work_date: { lt: today },
        },
      },
      include: {
        workDate: {
          include: {
            job: {
              include: {
                facility: true,
              },
            },
          },
        },
      },
      orderBy: {
        workDate: {
          work_date: 'desc',
        },
      },
      take: 50,
    });

    const formatSchedule = (app: typeof upcomingApplications[0]) => ({
      id: app.id,
      workDate: app.workDate.work_date.toISOString().split('T')[0],
      startTime: app.workDate.job.start_time,
      endTime: app.workDate.job.end_time,
      jobTitle: app.workDate.job.title,
      facilityName: app.workDate.job.facility.facility_name,
      status: app.status,
    });

    return NextResponse.json({
      workerId: worker.id,
      workerName: worker.name,
      upcomingSchedules: upcomingApplications.map(formatSchedule),
      pastSchedules: pastApplications.map(formatSchedule),
    });
  } catch (error) {
    console.error('[Worker Schedules API] Error:', error);
    return NextResponse.json(
      { error: '勤務予定の取得に失敗しました' },
      { status: 500 }
    );
  }
}
