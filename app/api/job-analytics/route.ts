import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// JST日付文字列 (YYYY-MM-DD) を返す
function toJSTDateStr(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

// JST年月文字列 (YYYY-MM) を返す
function toJSTMonthStr(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const breakdown = searchParams.get('breakdown'); // 'daily' | 'monthly' | null

    // 日付フィルター（JST基準）
    const dateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      dateFilter.created_at = { ...dateFilter.created_at, gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      dateFilter.created_at = { ...dateFilter.created_at, lte: new Date(`${endDate}T23:59:59.999+09:00`) };
    }

    // 1. 求人詳細PV（JobDetailPageView - ログイン後ユーザー全体）
    const jobDetailViews = await prisma.jobDetailPageView.findMany({
      where: { ...dateFilter },
      select: { user_id: true, job_id: true, created_at: true },
    });

    const totalPV = jobDetailViews.length;
    const totalUsers = new Set(jobDetailViews.map(v => v.user_id)).size;

    // 2. 応募データ（全ユーザー）
    const applications = await prisma.application.findMany({
      where: { ...dateFilter },
      select: { user_id: true, workDate: { select: { job_id: true } }, created_at: true },
    });

    const applicationCount = applications.length;
    const applicationUserCount = new Set(applications.map(a => a.user_id)).size;
    const avgApplicationDays = applicationUserCount > 0
      ? Math.round((applicationCount / applicationUserCount) * 10) / 10
      : 0;

    // ========== ブレイクダウン集計 ==========
    let breakdownData: Array<{
      period: string;
      totalPV: number;
      totalUsers: number;
      applicationCount: number;
      applicationUserCount: number;
      avgApplicationDays: number;
    }> | null = null;

    if (breakdown === 'daily' || breakdown === 'monthly') {
      const keyFn = breakdown === 'daily' ? toJSTDateStr : toJSTMonthStr;

      const periodMap = new Map<string, {
        pvUsers: Set<number>;
        pvCount: number;
        appUsers: Set<number>;
        appCount: number;
      }>();

      const ensurePeriod = (key: string) => {
        if (!periodMap.has(key)) periodMap.set(key, { pvUsers: new Set(), pvCount: 0, appUsers: new Set(), appCount: 0 });
        return periodMap.get(key)!;
      };

      // PV
      jobDetailViews.forEach(v => {
        const key = keyFn(v.created_at);
        const entry = ensurePeriod(key);
        entry.pvCount++;
        entry.pvUsers.add(v.user_id);
      });

      // 応募
      applications.forEach(a => {
        const key = keyFn(a.created_at);
        const entry = ensurePeriod(key);
        entry.appCount++;
        entry.appUsers.add(a.user_id);
      });

      breakdownData = Array.from(periodMap.entries())
        .map(([period, d]) => {
          const appUserCount = d.appUsers.size;
          return {
            period,
            totalPV: d.pvCount,
            totalUsers: d.pvUsers.size,
            applicationCount: d.appCount,
            applicationUserCount: appUserCount,
            avgApplicationDays: appUserCount > 0 ? Math.round((d.appCount / appUserCount) * 10) / 10 : 0,
          };
        })
        .sort((a, b) => a.period.localeCompare(b.period));
    }

    // 3. 求人ランキング集計
    const jobStatsMap = new Map<number, {
      pv: number;
      users: Set<number>;
      applicationCount: number;
      applicationUsers: Set<number>;
    }>();

    const ensureEntry = (jobId: number) => {
      if (!jobStatsMap.has(jobId)) {
        jobStatsMap.set(jobId, { pv: 0, users: new Set(), applicationCount: 0, applicationUsers: new Set() });
      }
      return jobStatsMap.get(jobId)!;
    };

    // PV集計
    jobDetailViews.forEach(v => {
      const entry = ensureEntry(v.job_id);
      entry.pv++;
      entry.users.add(v.user_id);
    });

    // 応募集計
    applications.forEach(a => {
      const jobId = a.workDate?.job_id;
      if (jobId) {
        const entry = ensureEntry(jobId);
        entry.applicationCount++;
        entry.applicationUsers.add(a.user_id);
      }
    });

    // 求人情報取得（タイトル + ステータス）
    const jobIds = Array.from(jobStatsMap.keys());
    const jobs = jobIds.length > 0 ? await prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true, status: true },
    }) : [];
    const jobInfoMap = new Map(jobs.map(j => [j.id, { title: j.title, status: j.status }]));

    // activeOnlyフィルター: PUBLISHED または WORKING のみ
    const activeStatuses = ['PUBLISHED', 'WORKING'];

    const jobRanking = Array.from(jobStatsMap.entries())
      .filter(([jobId]) => {
        if (!activeOnly) return true;
        const info = jobInfoMap.get(jobId);
        return info ? activeStatuses.includes(info.status) : false;
      })
      .map(([jobId, data]) => {
        const info = jobInfoMap.get(jobId);
        const users = data.users.size;
        const appUsers = data.applicationUsers.size;
        return {
          jobId,
          jobTitle: info?.title || `求人 #${jobId}`,
          status: info?.status || 'UNKNOWN',
          pv: data.pv,
          users,
          applicationCount: data.applicationCount,
          applicationRate: users > 0 ? Math.round((appUsers / users) * 1000) / 10 : 0,
          avgApplicationDays: appUsers > 0 ? Math.round((data.applicationCount / appUsers) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => b.pv - a.pv)
      .slice(0, 100);

    return NextResponse.json({
      totalPV,
      totalUsers,
      applicationCount,
      applicationUserCount,
      avgApplicationDays,
      jobRanking,
      ...(breakdownData ? { breakdown: breakdownData } : {}),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Job analytics fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch job analytics data' }, { status: 500 });
  }
}
