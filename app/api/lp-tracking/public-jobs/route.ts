import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LP_ID = '0';

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
    const genrePrefix = searchParams.get('genrePrefix');
    const breakdown = searchParams.get('breakdown'); // 'daily' | 'monthly' | null

    // 日付フィルター（JST基準）
    const dateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      dateFilter.created_at = { ...dateFilter.created_at, gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      dateFilter.created_at = { ...dateFilter.created_at, lte: new Date(`${endDate}T23:59:59.999+09:00`) };
    }

    // キャンペーンコードのジャンルフィルター
    const campaignFilter = genrePrefix
      ? { campaign_code: { startsWith: genrePrefix + '-' } }
      : {};

    // 1. PV（LpPageView lp_id="0"）
    const pageViews = await prisma.lpPageView.findMany({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      select: { session_id: true, campaign_code: true, created_at: true },
    });
    const totalPV = pageViews.length;

    // 2. ユニークセッション数
    const sessionSet = new Set(pageViews.map(pv => pv.session_id));
    const totalSessions = sessionSet.size;

    // 3. 求人詳細PV（PublicJobPageView）
    const jobPageViews = await prisma.publicJobPageView.findMany({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      select: { job_id: true, session_id: true, campaign_code: true, created_at: true },
    });
    const jobDetailPV = jobPageViews.length;

    // 4. CTAクリック（LpClickEvent button_id="cta_register"）
    const ctaClickEvents = await prisma.lpClickEvent.findMany({
      where: {
        lp_id: LP_ID,
        button_id: 'cta_register',
        ...dateFilter,
        ...campaignFilter,
      },
      select: { id: true, campaign_code: true, job_id: true, created_at: true },
    });
    const ctaClicks = ctaClickEvents.length;

    // 5. CTR
    const ctr = totalSessions > 0 ? Math.round((ctaClicks / totalSessions) * 1000) / 10 : 0;

    // 6. 登録数（User.registration_lp_id="0"）
    const registrationDateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      registrationDateFilter.created_at = { gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      registrationDateFilter.created_at = { ...registrationDateFilter.created_at, lte: new Date(`${endDate}T23:59:59.999+09:00`) };
    }

    const registrationCampaignFilter = genrePrefix
      ? { registration_campaign_code: { startsWith: genrePrefix + '-' } }
      : {};

    const registeredUsers = await prisma.user.findMany({
      where: {
        registration_lp_id: LP_ID,
        ...registrationDateFilter,
        ...registrationCampaignFilter,
      },
      select: { id: true, registration_campaign_code: true, created_at: true },
    });
    const registrations = registeredUsers.length;

    // 7. CVR
    const cvr = totalSessions > 0 ? Math.round((registrations / totalSessions) * 1000) / 10 : 0;

    // 8. 平均滞在時間（aggregateで集約しメモリ節約）
    const engagementAgg = await prisma.lpEngagementSummary.aggregate({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      _avg: { total_dwell_time: true },
    });
    const avgDwellTime = engagementAgg._avg.total_dwell_time
      ? Math.round(engagementAgg._avg.total_dwell_time)
      : 0;

    // ========== LP0帰属ユーザーを一括取得 ==========
    const lp0RegisteredUsers = await prisma.user.findMany({
      where: {
        registration_lp_id: LP_ID,
        ...registrationCampaignFilter,
      },
      select: { id: true, registration_campaign_code: true },
    });
    const lp0AllUserCampaignMap = new Map(lp0RegisteredUsers.map(u => [u.id, u.registration_campaign_code]));
    const lp0AllUserIdSet = new Set(lp0RegisteredUsers.map(u => u.id));

    // ========== 親求人PV/セッション（LP0帰属） ==========
    const lp0UserIds = Array.from(lp0AllUserIdSet);
    const lp0JobDetailViews: { user_id: number; job_id: number; created_at: Date }[] = lp0UserIds.length > 0
      ? await prisma.jobDetailPageView.findMany({
          where: {
            ...dateFilter,
            user_id: { in: lp0UserIds },
          },
          select: { user_id: true, job_id: true, created_at: true },
        })
      : [];

    const parentJobPV = lp0JobDetailViews.length;
    const parentJobUserSet = new Set(lp0JobDetailViews.map(v => v.user_id));
    const parentJobSessions = parentJobUserSet.size;

    // ========== 応募数（LP0帰属） ==========
    const lp0Applications = await prisma.application.findMany({
      where: {
        ...registrationDateFilter,
        user: {
          registration_lp_id: LP_ID,
          ...registrationCampaignFilter,
        },
      },
      select: { user_id: true, workDate: { select: { job_id: true } }, created_at: true },
    });
    const applicationCount = lp0Applications.length;
    const applicationUserCount = new Set(lp0Applications.map(a => a.user_id)).size;

    // 応募率 = 応募したユニークユーザー数 / 登録数 × 100
    const applicationRate = registrations > 0
      ? Math.round((applicationUserCount / registrations) * 1000) / 10
      : 0;

    // ========== 平均応募日数（LP0帰属） ==========
    const avgDaysToApplication = applicationUserCount > 0
      ? Math.round((applicationCount / applicationUserCount) * 10) / 10
      : 0;

    // ========== ブレイクダウン集計 ==========
    let breakdownData: Array<{
      period: string;
      pv: number;
      sessions: number;
      jobDetailPV: number;
      ctaClicks: number;
      ctr: number;
      registrations: number;
      cvr: number;
      parentJobPV: number;
      parentJobSessions: number;
      applicationCount: number;
      applicationUserCount: number;
      applicationRate: number;
      avgDaysToApplication: number;
    }> | null = null;

    if (breakdown === 'daily' || breakdown === 'monthly') {
      const keyFn = breakdown === 'daily' ? toJSTDateStr : toJSTMonthStr;

      const periodMap = new Map<string, {
        pv: number;
        sessions: Set<string>;
        jobDetailPV: number;
        ctaClicks: number;
        registrations: number;
        parentJobPV: number;
        parentJobUsers: Set<number>;
        applications: number;
        appUsers: Set<number>;
      }>();

      const emptyPeriodEntry = () => ({
        pv: 0, sessions: new Set<string>(), jobDetailPV: 0, ctaClicks: 0, registrations: 0,
        parentJobPV: 0, parentJobUsers: new Set<number>(), applications: 0, appUsers: new Set<number>(),
      });

      const ensurePeriod = (key: string) => {
        if (!periodMap.has(key)) periodMap.set(key, emptyPeriodEntry());
        return periodMap.get(key)!;
      };

      // PV
      pageViews.forEach(pv => {
        const key = keyFn(pv.created_at);
        const entry = ensurePeriod(key);
        entry.pv++;
        entry.sessions.add(pv.session_id);
      });

      // 求人閲覧PV
      jobPageViews.forEach(jpv => {
        const key = keyFn(jpv.created_at);
        ensurePeriod(key).jobDetailPV++;
      });

      // CTAクリック
      ctaClickEvents.forEach(c => {
        const key = keyFn(c.created_at);
        ensurePeriod(key).ctaClicks++;
      });

      // 登録
      registeredUsers.forEach(u => {
        const key = keyFn(u.created_at);
        ensurePeriod(key).registrations++;
      });

      // 親求人PV
      lp0JobDetailViews.forEach(v => {
        if (!lp0AllUserIdSet.has(v.user_id)) return;
        const key = keyFn(v.created_at);
        const entry = ensurePeriod(key);
        entry.parentJobPV++;
        entry.parentJobUsers.add(v.user_id);
      });

      // 応募
      lp0Applications.forEach(a => {
        const key = keyFn(a.created_at);
        const entry = ensurePeriod(key);
        entry.applications++;
        entry.appUsers.add(a.user_id);
      });

      breakdownData = Array.from(periodMap.entries())
        .map(([period, d]) => {
          const sessions = d.sessions.size;
          const appUserCount = d.appUsers.size;
          return {
            period,
            pv: d.pv,
            sessions,
            jobDetailPV: d.jobDetailPV,
            ctaClicks: d.ctaClicks,
            ctr: sessions > 0 ? Math.round((d.ctaClicks / sessions) * 1000) / 10 : 0,
            registrations: d.registrations,
            cvr: sessions > 0 ? Math.round((d.registrations / sessions) * 1000) / 10 : 0,
            parentJobPV: d.parentJobPV,
            parentJobSessions: d.parentJobUsers.size,
            applicationCount: d.applications,
            applicationUserCount: appUserCount,
            applicationRate: d.registrations > 0 ? Math.round((appUserCount / d.registrations) * 1000) / 10 : 0,
            avgDaysToApplication: appUserCount > 0 ? Math.round((d.applications / appUserCount) * 10) / 10 : 0,
          };
        })
        .sort((a, b) => a.period.localeCompare(b.period));
    }

    // 9. キャンペーンコード別の内訳
    const campaignCodeMap = new Map<string, {
      pv: number;
      sessions: Set<string>;
      jobDetailPV: number;
      ctaClicks: number;
      registrations: number;
      parentJobPV: number;
      parentJobUsers: Set<number>;
      applications: number;
      appUsers: Set<number>;
    }>();

    const emptyEntry = () => ({
      pv: 0, sessions: new Set<string>(), jobDetailPV: 0, ctaClicks: 0, registrations: 0,
      parentJobPV: 0, parentJobUsers: new Set<number>(), applications: 0, appUsers: new Set<number>(),
    });

    pageViews.forEach(pv => {
      const code = pv.campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) campaignCodeMap.set(code, emptyEntry());
      const entry = campaignCodeMap.get(code)!;
      entry.pv++;
      entry.sessions.add(pv.session_id);
    });

    jobPageViews.forEach(jpv => {
      const code = jpv.campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) campaignCodeMap.set(code, emptyEntry());
      campaignCodeMap.get(code)!.jobDetailPV++;
    });

    // CTAクリックをキャンペーンコード別に集計
    const ctaClicksByCode = await prisma.lpClickEvent.groupBy({
      by: ['campaign_code'],
      _count: { id: true },
      where: {
        lp_id: LP_ID,
        button_id: 'cta_register',
        ...dateFilter,
        ...campaignFilter,
      },
    });

    ctaClicksByCode.forEach(c => {
      const code = c.campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) campaignCodeMap.set(code, emptyEntry());
      campaignCodeMap.get(code)!.ctaClicks = c._count.id;
    });

    // 登録をキャンペーンコード別に集計
    const registrationsByCode = await prisma.user.groupBy({
      by: ['registration_campaign_code'],
      _count: { id: true },
      where: {
        registration_lp_id: LP_ID,
        ...registrationDateFilter,
        ...registrationCampaignFilter,
      },
    });

    registrationsByCode.forEach(r => {
      const code = r.registration_campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) campaignCodeMap.set(code, emptyEntry());
      campaignCodeMap.get(code)!.registrations = r._count.id;
    });

    lp0JobDetailViews.forEach(v => {
      if (!lp0AllUserIdSet.has(v.user_id)) return;
      const campaign = lp0AllUserCampaignMap.get(v.user_id) || '(direct)';
      if (!campaignCodeMap.has(campaign)) campaignCodeMap.set(campaign, emptyEntry());
      const entry = campaignCodeMap.get(campaign)!;
      entry.parentJobPV++;
      entry.parentJobUsers.add(v.user_id);
    });

    lp0Applications.forEach(a => {
      const campaign = lp0AllUserCampaignMap.get(a.user_id) || '(direct)';
      if (!campaignCodeMap.has(campaign)) campaignCodeMap.set(campaign, emptyEntry());
      const entry = campaignCodeMap.get(campaign)!;
      entry.applications++;
      entry.appUsers.add(a.user_id);
    });

    const campaignBreakdown = Array.from(campaignCodeMap.entries()).map(([code, data]) => {
      const sessions = data.sessions.size;
      const campAvgDays = data.appUsers.size > 0
        ? Math.round((data.applications / data.appUsers.size) * 10) / 10
        : 0;
      return {
        campaignCode: code,
        pv: data.pv,
        sessions,
        jobDetailPV: data.jobDetailPV,
        ctaClicks: data.ctaClicks,
        ctr: sessions > 0 ? Math.round((data.ctaClicks / sessions) * 1000) / 10 : 0,
        registrations: data.registrations,
        cvr: sessions > 0 ? Math.round((data.registrations / sessions) * 1000) / 10 : 0,
        parentJobPV: data.parentJobPV,
        parentJobSessions: data.parentJobUsers.size,
        applicationCount: data.applications,
        applicationUserCount: data.appUsers.size,
        applicationRate: data.registrations > 0 ? Math.round((data.appUsers.size / data.registrations) * 1000) / 10 : 0,
        avgDaysToApplication: campAvgDays,
      };
    }).sort((a, b) => b.pv - a.pv);

    // 10. 求人ランキング
    const jobViewsGrouped = new Map<number, {
      pv: number;
      sessions: Set<string>;
      ctaClicks: number;
    }>();

    const ensureJobEntry = (jobId: number) => {
      if (!jobViewsGrouped.has(jobId)) {
        jobViewsGrouped.set(jobId, { pv: 0, sessions: new Set(), ctaClicks: 0 });
      }
      return jobViewsGrouped.get(jobId)!;
    };

    jobPageViews.forEach(jpv => {
      const entry = ensureJobEntry(jpv.job_id);
      entry.pv++;
      entry.sessions.add(jpv.session_id);
    });

    // CTAクリック（job_id別）
    const ctaClicksByJob = ctaClickEvents.filter(c => c.job_id != null);
    ctaClicksByJob.forEach(c => {
      if (c.job_id) {
        ensureJobEntry(c.job_id).ctaClicks++;
      }
    });

    const jobIds = Array.from(jobViewsGrouped.keys());
    const jobs = jobIds.length > 0 ? await prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    }) : [];
    const jobTitleMap = new Map(jobs.map(j => [j.id, j.title]));

    const jobRanking = Array.from(jobViewsGrouped.entries()).map(([jobId, data]) => {
      const sessions = data.sessions.size;
      return {
        jobId,
        jobTitle: jobTitleMap.get(jobId) || `求人 #${jobId}`,
        pv: data.pv,
        sessions,
        ctaClicks: data.ctaClicks,
        ctr: sessions > 0 ? Math.round((data.ctaClicks / sessions) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.pv - a.pv).slice(0, 50);

    return NextResponse.json({
      totalPV,
      totalSessions,
      jobDetailPV,
      ctaClicks,
      ctr,
      registrations,
      cvr,
      avgDwellTime,
      parentJobPV,
      parentJobSessions,
      applicationCount,
      applicationUserCount,
      applicationRate,
      avgDaysToApplication,
      campaignBreakdown,
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
    console.error('Public jobs tracking fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
