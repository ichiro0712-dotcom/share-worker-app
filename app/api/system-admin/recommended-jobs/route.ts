import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

const MAX_RECOMMENDED_JOBS = 20;
const JST_OFFSET = 9 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  // 求人番号で1件取得モード
  if (jobId) {
    const id = parseInt(jobId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: '無効な求人番号です' }, { status: 400 });
    }

    // 既に登録済みかチェック
    const existing = await prisma.recommendedJob.findFirst({
      where: { job_id: id },
    });
    if (existing) {
      return NextResponse.json({ error: '既に登録済みです' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        facility: { select: { id: true, facility_name: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: '求人が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        facility: { id: job.facility.id, name: job.facility.facility_name },
      },
    });
  }

  // 一覧モード: 登録済みおすすめ求人を返す（残り日数付き）
  const recommendedJobs = await prisma.recommendedJob.findMany({
    orderBy: { sort_order: 'asc' },
    include: {
      job: {
        include: {
          facility: { select: { id: true, facility_name: true } },
          workDates: {
            orderBy: { work_date: 'asc' },
          },
        },
      },
    },
  });

  // 今日（JST）の0時を計算
  const now = new Date();
  const nowJST = new Date(now.getTime() + JST_OFFSET);
  const todayStr = nowJST.toISOString().split('T')[0];

  return NextResponse.json({
    jobs: recommendedJobs.map(r => {
      // 今日以降の勤務日数を計算
      const futureWorkDates = r.job.workDates.filter(wd => {
        const wdJST = new Date(wd.work_date.getTime() + JST_OFFSET);
        return wdJST.toISOString().split('T')[0] >= todayStr;
      });

      // 最も近い勤務日までの残り日数
      let remainingDays: number | null = null;
      if (futureWorkDates.length > 0) {
        const nearestDate = futureWorkDates[0].work_date;
        const nearestJST = new Date(nearestDate.getTime() + JST_OFFSET);
        const nearestStr = nearestJST.toISOString().split('T')[0];
        const diffMs = new Date(nearestStr).getTime() - new Date(todayStr).getTime();
        remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        id: r.id,
        sort_order: r.sort_order,
        job: {
          id: r.job.id,
          title: r.job.title,
          status: r.job.status,
          facility: { id: r.job.facility.id, name: r.job.facility.facility_name },
        },
        futureWorkDateCount: futureWorkDates.length,
        remainingDays,
      };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { jobIds } = body as { jobIds: number[] };

    if (!Array.isArray(jobIds)) {
      return NextResponse.json({ error: 'jobIds must be an array' }, { status: 400 });
    }

    if (jobIds.length > MAX_RECOMMENDED_JOBS) {
      return NextResponse.json({ error: `最大${MAX_RECOMMENDED_JOBS}件までです` }, { status: 400 });
    }

    // 重複チェック
    if (new Set(jobIds).size !== jobIds.length) {
      return NextResponse.json({ error: '重複した求人IDがあります' }, { status: 400 });
    }

    // 求人IDの存在チェック
    if (jobIds.length > 0) {
      const existingJobs = await prisma.job.findMany({
        where: { id: { in: jobIds } },
        select: { id: true },
      });
      const existingIdSet = new Set(existingJobs.map(j => j.id));
      const missingIds = jobIds.filter(id => !existingIdSet.has(id));
      if (missingIds.length > 0) {
        return NextResponse.json({ error: `存在しない求人ID: ${missingIds.join(', ')}` }, { status: 400 });
      }
    }

    // トランザクションで全削除→再登録
    await prisma.$transaction(async (tx) => {
      await tx.recommendedJob.deleteMany();
      if (jobIds.length > 0) {
        await tx.recommendedJob.createMany({
          data: jobIds.map((jobId, index) => ({
            job_id: jobId,
            sort_order: index,
          })),
        });
      }
    });

    return NextResponse.json({ success: true, count: jobIds.length });
  } catch (error) {
    console.error('Recommended jobs update error:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}
