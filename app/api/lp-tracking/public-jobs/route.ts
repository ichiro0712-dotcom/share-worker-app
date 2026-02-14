import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LP_ID = '0';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const genrePrefix = searchParams.get('genrePrefix');

    // 日付フィルター
    const dateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      dateFilter.created_at = { ...dateFilter.created_at, gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.created_at = { ...dateFilter.created_at, lte: end };
    }

    // キャンペーンコードのジャンルフィルター
    const campaignFilter = genrePrefix
      ? { campaign_code: { startsWith: genrePrefix + '-' } }
      : {};

    // 1. PV（LpPageView lp_id="0"）
    const pageViews = await prisma.lpPageView.findMany({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      select: { session_id: true, campaign_code: true },
    });
    const totalPV = pageViews.length;

    // 2. ユニークセッション数
    const sessionSet = new Set(pageViews.map(pv => pv.session_id));
    const totalSessions = sessionSet.size;

    // 3. 求人詳細PV（PublicJobPageView）
    const jobPageViews = await prisma.publicJobPageView.findMany({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      select: { job_id: true, session_id: true, campaign_code: true },
    });
    const jobDetailPV = jobPageViews.length;

    // 4. CTAクリック（LpClickEvent button_id="cta_register"）
    const ctaClicks = await prisma.lpClickEvent.count({
      where: {
        lp_id: LP_ID,
        button_id: 'cta_register',
        ...dateFilter,
        ...campaignFilter,
      },
    });

    // 5. CTR
    const ctr = totalSessions > 0 ? Math.round((ctaClicks / totalSessions) * 1000) / 10 : 0;

    // 6. 登録数（User.registration_lp_id="0"）
    const registrationDateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      registrationDateFilter.created_at = { gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      registrationDateFilter.created_at = { ...registrationDateFilter.created_at, lte: end };
    }

    const registrationCampaignFilter = genrePrefix
      ? { registration_campaign_code: { startsWith: genrePrefix + '-' } }
      : {};

    const registrations = await prisma.user.count({
      where: {
        registration_lp_id: LP_ID,
        ...registrationDateFilter,
        ...registrationCampaignFilter,
      },
    });

    // 7. CVR
    const cvr = totalSessions > 0 ? Math.round((registrations / totalSessions) * 1000) / 10 : 0;

    // 8. 平均滞在時間
    const engagementSummaries = await prisma.lpEngagementSummary.findMany({
      where: { lp_id: LP_ID, ...dateFilter, ...campaignFilter },
      select: { total_dwell_time: true },
    });
    const avgDwellTime = engagementSummaries.length > 0
      ? Math.round(engagementSummaries.reduce((sum, e) => sum + e.total_dwell_time, 0) / engagementSummaries.length)
      : 0;

    // 9. キャンペーンコード別の内訳
    const campaignCodeMap = new Map<string, {
      pv: number;
      sessions: Set<string>;
      jobDetailPV: number;
      ctaClicks: number;
      registrations: number;
    }>();

    // PVをキャンペーンコード別に集計
    pageViews.forEach(pv => {
      const code = pv.campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) {
        campaignCodeMap.set(code, { pv: 0, sessions: new Set(), jobDetailPV: 0, ctaClicks: 0, registrations: 0 });
      }
      const entry = campaignCodeMap.get(code)!;
      entry.pv++;
      entry.sessions.add(pv.session_id);
    });

    // 求人詳細PVをキャンペーンコード別に集計
    jobPageViews.forEach(jpv => {
      const code = jpv.campaign_code || '(direct)';
      if (!campaignCodeMap.has(code)) {
        campaignCodeMap.set(code, { pv: 0, sessions: new Set(), jobDetailPV: 0, ctaClicks: 0, registrations: 0 });
      }
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
      if (!campaignCodeMap.has(code)) {
        campaignCodeMap.set(code, { pv: 0, sessions: new Set(), jobDetailPV: 0, ctaClicks: 0, registrations: 0 });
      }
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
      if (!campaignCodeMap.has(code)) {
        campaignCodeMap.set(code, { pv: 0, sessions: new Set(), jobDetailPV: 0, ctaClicks: 0, registrations: 0 });
      }
      campaignCodeMap.get(code)!.registrations = r._count.id;
    });

    const campaignBreakdown = Array.from(campaignCodeMap.entries()).map(([code, data]) => {
      const sessions = data.sessions.size;
      return {
        campaignCode: code,
        pv: data.pv,
        sessions,
        jobDetailPV: data.jobDetailPV,
        ctaClicks: data.ctaClicks,
        ctr: sessions > 0 ? Math.round((data.ctaClicks / sessions) * 1000) / 10 : 0,
        registrations: data.registrations,
        cvr: sessions > 0 ? Math.round((data.registrations / sessions) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.pv - a.pv);

    // 10. 閲覧求人ランキング
    const jobViewsGrouped = new Map<number, {
      pv: number;
      sessions: Set<string>;
    }>();

    jobPageViews.forEach(jpv => {
      if (!jobViewsGrouped.has(jpv.job_id)) {
        jobViewsGrouped.set(jpv.job_id, { pv: 0, sessions: new Set() });
      }
      const entry = jobViewsGrouped.get(jpv.job_id)!;
      entry.pv++;
      entry.sessions.add(jpv.session_id);
    });

    // 求人タイトルを取得
    const jobIds = Array.from(jobViewsGrouped.keys());
    const jobs = jobIds.length > 0 ? await prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    }) : [];
    const jobTitleMap = new Map(jobs.map(j => [j.id, j.title]));

    const jobRanking = Array.from(jobViewsGrouped.entries()).map(([jobId, data]) => ({
      jobId,
      jobTitle: jobTitleMap.get(jobId) || `求人 #${jobId}`,
      pv: data.pv,
      sessions: data.sessions.size,
    })).sort((a, b) => b.pv - a.pv).slice(0, 50);

    return NextResponse.json({
      totalPV,
      totalSessions,
      jobDetailPV,
      ctaClicks,
      ctr,
      registrations,
      cvr,
      avgDwellTime,
      campaignBreakdown,
      jobRanking,
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
