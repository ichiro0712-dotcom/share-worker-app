import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// バリデーションヘルパー
function isValidString(value: unknown, maxLength: number = 500): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isValidNumber(value: unknown, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// 許可されたイベントタイプ
const VALID_EVENT_TYPES = ['pageview', 'click', 'scroll', 'dwell', 'section_dwell', 'engagement_summary', 'job_pageview'] as const;
type EventType = typeof VALID_EVENT_TYPES[number];

function isValidEventType(value: unknown): value is EventType {
  return typeof value === 'string' && VALID_EVENT_TYPES.includes(value as EventType);
}

// POST: トラッキングイベントを記録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      lpId,
      campaignCode,
      sessionId,
      // scroll用
      scrollDepth,
      timeToReach,
      // dwell用
      dwellSeconds,
      // click用
      buttonId,
      buttonText,
      // section_dwell用
      sectionId,
      sectionName,
      // job_pageview用
      jobId,
      // engagement_summary用
      maxScrollDepth,
      totalDwellTime,
      engagementLevel,
      ctaClicked,
      utmSource,
      utmMedium,
      utmCampaign,
    } = body;

    // 基本バリデーション
    if (!isValidEventType(type)) {
      return NextResponse.json({ success: false, error: 'Invalid event type' });
    }

    if (!isValidString(lpId, 100)) {
      return NextResponse.json({ success: false, error: 'Invalid lpId' });
    }

    if (!isValidString(sessionId, 100)) {
      return NextResponse.json({ success: false, error: 'Invalid sessionId' });
    }

    // campaignCodeはオプショナルだが、存在する場合はバリデーション
    if (campaignCode !== undefined && campaignCode !== null && !isValidString(campaignCode, 100)) {
      return NextResponse.json({ success: false, error: 'Invalid campaignCode' });
    }

    // 基本情報
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;

    switch (type) {
      case 'pageview':
        await prisma.lpPageView.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            user_agent: userAgent,
            referrer: referrer,
            ip_address: ipAddress,
          },
        });
        break;

      case 'click':
        // clickイベントのバリデーション
        if (!isValidString(buttonId, 200)) {
          return NextResponse.json({ success: false, error: 'Invalid buttonId for click event' });
        }
        await prisma.lpClickEvent.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            button_id: buttonId,
            button_text: typeof buttonText === 'string' ? buttonText.slice(0, 500) : null,
          },
        });
        break;

      case 'scroll':
        // scrollイベントのバリデーション
        if (!isValidNumber(scrollDepth, 0, 100)) {
          return NextResponse.json({ success: false, error: 'Invalid scrollDepth (must be 0-100)' });
        }
        await prisma.lpScrollEvent.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            scroll_depth: scrollDepth,
            time_to_reach: isValidNumber(timeToReach, 0, 86400) ? timeToReach : null,
          },
        });
        break;

      case 'dwell':
        // dwellイベントのバリデーション（最大24時間=86400秒）
        if (!isValidNumber(dwellSeconds, 0, 86400)) {
          return NextResponse.json({ success: false, error: 'Invalid dwellSeconds (must be 0-86400)' });
        }
        await prisma.lpDwellEvent.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            dwell_seconds: dwellSeconds,
          },
        });
        break;

      case 'section_dwell':
        // section_dwellイベントのバリデーション
        if (!isValidString(sectionId, 200)) {
          return NextResponse.json({ success: false, error: 'Invalid sectionId for section_dwell event' });
        }
        if (!isValidNumber(dwellSeconds, 0, 86400)) {
          return NextResponse.json({ success: false, error: 'Invalid dwellSeconds (must be 0-86400)' });
        }
        await prisma.lpSectionDwell.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            section_id: sectionId,
            section_name: typeof sectionName === 'string' ? sectionName.slice(0, 200) : null,
            dwell_seconds: dwellSeconds,
          },
        });
        break;

      case 'engagement_summary':
        // engagement_summaryイベントのバリデーション
        const validMaxScrollDepth = isValidNumber(maxScrollDepth, 0, 100) ? maxScrollDepth : 0;
        const validTotalDwellTime = isValidNumber(totalDwellTime, 0, 86400) ? totalDwellTime : 0;
        const validEngagementLevel = isValidNumber(engagementLevel, 0, 5) ? engagementLevel : 0;
        const validCtaClicked = isValidBoolean(ctaClicked) ? ctaClicked : false;

        await prisma.lpEngagementSummary.upsert({
          where: { session_id: sessionId },
          create: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            max_scroll_depth: validMaxScrollDepth,
            total_dwell_time: validTotalDwellTime,
            engagement_level: validEngagementLevel,
            cta_clicked: validCtaClicked,
            utm_source: typeof utmSource === 'string' ? utmSource.slice(0, 100) : null,
            utm_medium: typeof utmMedium === 'string' ? utmMedium.slice(0, 100) : null,
            utm_campaign: typeof utmCampaign === 'string' ? utmCampaign.slice(0, 200) : null,
          },
          update: {
            max_scroll_depth: validMaxScrollDepth,
            total_dwell_time: validTotalDwellTime,
            engagement_level: validEngagementLevel,
            cta_clicked: validCtaClicked,
          },
        });
        break;

      case 'job_pageview':
        // job_pageviewイベントのバリデーション
        if (!isValidNumber(jobId, 1)) {
          return NextResponse.json({ success: false, error: 'Invalid jobId for job_pageview event' });
        }
        // LpPageViewにも記録（PV集計用）
        await prisma.lpPageView.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            user_agent: userAgent,
            referrer: referrer,
            ip_address: ipAddress,
          },
        });
        // PublicJobPageViewに求人ID付きで記録
        await prisma.publicJobPageView.create({
          data: {
            lp_id: lpId,
            campaign_code: campaignCode || null,
            session_id: sessionId,
            job_id: jobId,
            user_agent: userAgent,
            referrer: referrer,
            ip_address: ipAddress,
          },
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LP tracking error:', error);
    // トラッキングエラーは200を返す（ユーザー体験に影響させない）
    return NextResponse.json({ success: false });
  }
}

// GET: トラッキングデータを取得（管理画面用）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lpId = searchParams.get('lpId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeEngagement = searchParams.get('includeEngagement') === 'true';

    // 日付フィルター（JST基準）
    // フロントエンドから "2026-02-17" のようなJST日付が送られるため、
    // JST 00:00:00 〜 23:59:59 の範囲でフィルタする
    const dateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      // "2026-02-17" → JST 00:00:00 = UTC前日15:00:00
      dateFilter.created_at = { ...dateFilter.created_at, gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      // "2026-02-17" → JST 23:59:59.999 = UTC 14:59:59.999
      dateFilter.created_at = { ...dateFilter.created_at, lte: new Date(`${endDate}T23:59:59.999+09:00`) };
    }

    // LP別の集計
    const pageViewsByLp = await prisma.lpPageView.groupBy({
      by: ['lp_id', 'campaign_code'],
      _count: { id: true },
      where: {
        ...(lpId && { lp_id: lpId }),
        ...dateFilter,
      },
    });

    const clicksByLp = await prisma.lpClickEvent.groupBy({
      by: ['lp_id', 'campaign_code', 'button_id'],
      _count: { id: true },
      where: {
        ...(lpId && { lp_id: lpId }),
        ...dateFilter,
      },
    });

    // ユニークセッション数（LP・キャンペーン別）
    // distinct: ['session_id'] は返る行のlp_id/campaign_codeが不定のため使用しない
    // 代わりに全PVを取得し、(lp_id, campaign_code, session_id) の組み合わせで正確にカウント
    const sessionData = await prisma.lpPageView.findMany({
      where: {
        ...(lpId && { lp_id: lpId }),
        ...dateFilter,
      },
      select: {
        lp_id: true,
        campaign_code: true,
        session_id: true,
      },
    });

    // LP・キャンペーン別にユニークセッション数を集計
    // 同一session_idでもlp_id/campaign_codeが異なればそれぞれカウント
    const sessionCountMap = new Map<string, Set<string>>();
    sessionData.forEach(s => {
      const key = `${s.lp_id}|${s.campaign_code || ''}`;
      if (!sessionCountMap.has(key)) {
        sessionCountMap.set(key, new Set());
      }
      sessionCountMap.get(key)!.add(s.session_id);
    });

    const uniqueSessionsByLp = Array.from(sessionCountMap.entries()).map(([key, sessions]) => {
      const [lp_id, campaign_code] = key.split('|');
      return {
        lp_id,
        campaign_code: campaign_code || null,
        _count: { session_id: sessions.size },
      };
    });

    // 日別推移（全件取得して正確に集計）
    const dailyPageViewsRaw = await prisma.lpPageView.findMany({
      where: {
        ...(lpId && { lp_id: lpId }),
        ...dateFilter,
      },
      select: {
        lp_id: true,
        campaign_code: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // 日別に集計（JST基準で日付を決定）
    const toJSTDateStr = (d: Date) => {
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      return jst.toISOString().split('T')[0];
    };
    const dailyMap = new Map<string, { date: string; lpId: string; campaignCode: string | null; count: number }>();
    dailyPageViewsRaw.forEach(pv => {
      const date = toJSTDateStr(pv.created_at);
      const key = `${date}_${pv.lp_id}_${pv.campaign_code || 'null'}`;
      const existing = dailyMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        dailyMap.set(key, { date, lpId: pv.lp_id, campaignCode: pv.campaign_code, count: 1 });
      }
    });
    const dailyPageViews = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);

    // LP経由登録数の集計（登録日時でフィルター、JST基準）
    const registrationDateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      registrationDateFilter.created_at = { ...registrationDateFilter.created_at, gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      registrationDateFilter.created_at = { ...registrationDateFilter.created_at, lte: new Date(`${endDate}T23:59:59.999+09:00`) };
    }

    const registrationsByLp = await prisma.user.groupBy({
      by: ['registration_lp_id', 'registration_campaign_code'],
      _count: { id: true },
      where: {
        registration_lp_id: { not: null },
        ...(lpId && { registration_lp_id: lpId }),
        ...registrationDateFilter,
      },
    });

    // 基本レスポンス
    const response: Record<string, unknown> = {
      pageViews: pageViewsByLp.map(pv => ({
        lpId: pv.lp_id,
        campaignCode: pv.campaign_code,
        count: pv._count.id,
      })),
      clicks: clicksByLp.map(c => ({
        lpId: c.lp_id,
        campaignCode: c.campaign_code,
        buttonId: c.button_id,
        count: c._count.id,
      })),
      uniqueSessions: uniqueSessionsByLp.map(us => ({
        lpId: us.lp_id,
        campaignCode: us.campaign_code,
        count: us._count.session_id,
      })),
      dailyPageViews: dailyPageViews,
      // LP経由登録数
      registrations: registrationsByLp.map(r => ({
        lpId: r.registration_lp_id,
        campaignCode: r.registration_campaign_code,
        count: r._count.id,
      })),
    };

    // エンゲージメントデータを含める場合
    if (includeEngagement) {
      // スクロール到達率
      const scrollStats = await prisma.lpScrollEvent.groupBy({
        by: ['lp_id', 'scroll_depth'],
        _count: { id: true },
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
      });

      // 滞在時間達成率
      const dwellStats = await prisma.lpDwellEvent.groupBy({
        by: ['lp_id', 'dwell_seconds'],
        _count: { id: true },
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
      });

      // エンゲージメントサマリー（全体）
      const engagementSummaries = await prisma.lpEngagementSummary.findMany({
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
        select: {
          lp_id: true,
          campaign_code: true,
          max_scroll_depth: true,
          total_dwell_time: true,
          engagement_level: true,
          cta_clicked: true,
        },
      });

      // エンゲージメントレベル分布
      const engagementDistribution = {
        all: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, total: 0 },
        ctaClicked: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, total: 0 },
        ctaNotClicked: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, total: 0 },
      };

      // 平均値計算用
      const avgStats = {
        all: { dwellTime: 0, scrollDepth: 0, engagementLevel: 0, count: 0 },
        ctaClicked: { dwellTime: 0, scrollDepth: 0, engagementLevel: 0, count: 0 },
        ctaNotClicked: { dwellTime: 0, scrollDepth: 0, engagementLevel: 0, count: 0 },
      };

      engagementSummaries.forEach(es => {
        const levelKey = `level${es.engagement_level}` as 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
        const category = es.cta_clicked ? 'ctaClicked' : 'ctaNotClicked';

        // 全体
        if (es.engagement_level >= 1 && es.engagement_level <= 5) {
          engagementDistribution.all[levelKey]++;
        }
        engagementDistribution.all.total++;
        avgStats.all.dwellTime += es.total_dwell_time;
        avgStats.all.scrollDepth += es.max_scroll_depth;
        avgStats.all.engagementLevel += es.engagement_level;
        avgStats.all.count++;

        // CTA別
        if (es.engagement_level >= 1 && es.engagement_level <= 5) {
          engagementDistribution[category][levelKey]++;
        }
        engagementDistribution[category].total++;
        avgStats[category].dwellTime += es.total_dwell_time;
        avgStats[category].scrollDepth += es.max_scroll_depth;
        avgStats[category].engagementLevel += es.engagement_level;
        avgStats[category].count++;
      });

      // 平均値計算
      const calculateAvg = (stats: typeof avgStats.all) => ({
        avgDwellTime: stats.count > 0 ? Math.round(stats.dwellTime / stats.count) : 0,
        avgScrollDepth: stats.count > 0 ? Math.round(stats.scrollDepth / stats.count) : 0,
        avgEngagementLevel: stats.count > 0 ? Math.round((stats.engagementLevel / stats.count) * 10) / 10 : 0,
        count: stats.count,
      });

      // セクション別滞在時間
      const sectionDwells = await prisma.lpSectionDwell.groupBy({
        by: ['lp_id', 'section_id', 'section_name'],
        _avg: { dwell_seconds: true },
        _count: { id: true },
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
      });

      // CTA状態のマップを作成（session_id -> cta_clicked）
      const ctaMap = new Map<string, boolean>();
      const allSummaries = await prisma.lpEngagementSummary.findMany({
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
        select: { session_id: true, cta_clicked: true },
      });
      allSummaries.forEach(s => ctaMap.set(s.session_id, s.cta_clicked));

      // セクション別滞在時間（CTA別）
      const allSectionDwells = await prisma.lpSectionDwell.findMany({
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
        select: { section_id: true, section_name: true, session_id: true, dwell_seconds: true },
      });

      // CTA別にセクション滞在時間を集計
      const sectionDwellsByCtaMap = new Map<string, { sectionId: string; sectionName: string | null; ctaClicked: boolean; totalDwell: number; count: number }>();
      allSectionDwells.forEach(sd => {
        const ctaClicked = ctaMap.get(sd.session_id) ?? false;
        const key = `${sd.section_id}_${ctaClicked}`;
        const existing = sectionDwellsByCtaMap.get(key);
        if (existing) {
          existing.totalDwell += sd.dwell_seconds;
          existing.count++;
        } else {
          sectionDwellsByCtaMap.set(key, {
            sectionId: sd.section_id,
            sectionName: sd.section_name,
            ctaClicked,
            totalDwell: sd.dwell_seconds,
            count: 1,
          });
        }
      });
      const sectionDwellsByCta = Array.from(sectionDwellsByCtaMap.values()).map(s => ({
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        ctaClicked: s.ctaClicked,
        avgDwellSeconds: s.count > 0 ? Math.round((s.totalDwell / s.count) * 10) / 10 : 0,
        count: s.count,
      }));

      // スクロール到達率をCTA別に集計
      const allScrollEvents = await prisma.lpScrollEvent.findMany({
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
        select: { scroll_depth: true, session_id: true },
      });

      const scrollByCtaMap = new Map<string, { scrollDepth: number; ctaClicked: boolean; count: number }>();
      allScrollEvents.forEach(se => {
        const ctaClicked = ctaMap.get(se.session_id) ?? false;
        const key = `${se.scroll_depth}_${ctaClicked}`;
        const existing = scrollByCtaMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          scrollByCtaMap.set(key, { scrollDepth: se.scroll_depth, ctaClicked, count: 1 });
        }
      });
      const scrollByCta = Array.from(scrollByCtaMap.values());

      // 滞在時間達成率をCTA別に集計
      const allDwellEvents = await prisma.lpDwellEvent.findMany({
        where: {
          ...(lpId && { lp_id: lpId }),
          ...dateFilter,
        },
        select: { dwell_seconds: true, session_id: true },
      });

      const dwellByCtaMap = new Map<string, { dwellSeconds: number; ctaClicked: boolean; count: number }>();
      allDwellEvents.forEach(de => {
        const ctaClicked = ctaMap.get(de.session_id) ?? false;
        const key = `${de.dwell_seconds}_${ctaClicked}`;
        const existing = dwellByCtaMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          dwellByCtaMap.set(key, { dwellSeconds: de.dwell_seconds, ctaClicked, count: 1 });
        }
      });
      const dwellByCta = Array.from(dwellByCtaMap.values());

      response.engagement = {
        distribution: engagementDistribution,
        averages: {
          all: calculateAvg(avgStats.all),
          ctaClicked: calculateAvg(avgStats.ctaClicked),
          ctaNotClicked: calculateAvg(avgStats.ctaNotClicked),
        },
        scrollStats: scrollStats.map(s => ({
          lpId: s.lp_id,
          scrollDepth: s.scroll_depth,
          count: s._count.id,
        })),
        scrollByCta: scrollByCta,
        dwellStats: dwellStats.map(d => ({
          lpId: d.lp_id,
          dwellSeconds: d.dwell_seconds,
          count: d._count.id,
        })),
        dwellByCta: dwellByCta,
        sectionDwells: sectionDwells.map(s => ({
          lpId: s.lp_id,
          sectionId: s.section_id,
          sectionName: s.section_name,
          avgDwellSeconds: s._avg.dwell_seconds || 0,
          count: s._count.id,
        })),
        sectionDwellsByCta: sectionDwellsByCta,
      };
    }

    // キャッシュを無効化して常に最新データを返す
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('LP tracking fetch error:', error);
    // 本番環境ではエラー詳細を返さない（情報漏洩防止）
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
