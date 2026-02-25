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
    const source = searchParams.get('source') || 'all'; // 'all' | カンマ区切り（例: 'direct,0,1'）
    const breakdown = searchParams.get('breakdown'); // 'daily' | 'monthly' | null

    // 日付フィルター（JST基準）- ユーザー登録日で絞り込み
    const registrationDateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate) {
      registrationDateFilter.created_at = { gte: new Date(`${startDate}T00:00:00+09:00`) };
    }
    if (endDate) {
      registrationDateFilter.created_at = {
        ...registrationDateFilter.created_at,
        lte: new Date(`${endDate}T23:59:59.999+09:00`),
      };
    }

    // ソースフィルター（複数選択対応）
    const sourceFilter: Record<string, unknown> = {};
    if (source !== 'all') {
      const sources = source.split(',').map(s => s.trim());
      const hasDirect = sources.includes('direct');
      const lpIds = sources.filter(s => s !== 'direct');

      if (hasDirect && lpIds.length > 0) {
        // direct + LP指定 → OR条件
        sourceFilter.OR = [
          { registration_lp_id: null },
          { registration_lp_id: { in: lpIds } },
        ];
      } else if (hasDirect) {
        sourceFilter.registration_lp_id = null;
      } else if (lpIds.length === 1) {
        sourceFilter.registration_lp_id = lpIds[0];
      } else if (lpIds.length > 1) {
        sourceFilter.registration_lp_id = { in: lpIds };
      }
    }

    // ========== Step 1: 登録ユーザー取得 ==========
    const registeredUsers = await prisma.user.findMany({
      where: {
        ...registrationDateFilter,
        ...sourceFilter,
      },
      select: {
        id: true,
        created_at: true,
        email_verified: true,
        email_verified_at: true,
        registration_lp_id: true,
      },
    });

    const userIds = registeredUsers.map(u => u.id);
    const registeredCount = registeredUsers.length;

    // ========== Step 2: メール認証完了 ==========
    const verifiedUsers = registeredUsers.filter(u => u.email_verified);
    const verifiedCount = verifiedUsers.length;

    // ========== Step 3: 求人検索ページ到達 ==========
    const jobSearchViews = userIds.length > 0
      ? await prisma.jobSearchPageView.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, created_at: true },
        })
      : [];
    const searchReachedUserIds = new Set(jobSearchViews.map(v => v.user_id));
    const searchReachedCount = searchReachedUserIds.size;

    // ========== Step 4: 求人詳細閲覧 ==========
    const jobDetailViews = userIds.length > 0
      ? await prisma.jobDetailPageView.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, created_at: true },
        })
      : [];
    const jobViewedUserIds = new Set(jobDetailViews.map(v => v.user_id));
    const jobViewedCount = jobViewedUserIds.size;
    const jobViewedPV = jobDetailViews.length;

    // ========== Step 5: お気に入り登録 ==========
    const bookmarks = userIds.length > 0
      ? await prisma.bookmark.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, created_at: true },
        })
      : [];
    const bookmarkedUserIds = new Set(bookmarks.filter(b => b.user_id !== null).map(b => b.user_id!));
    const bookmarkedCount = bookmarkedUserIds.size;

    // ========== Step 6: 応募完了 ==========
    const applications = userIds.length > 0
      ? await prisma.application.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, created_at: true },
        })
      : [];
    const appliedUserIds = new Set(applications.map(a => a.user_id));
    const appliedCount = appliedUserIds.size;
    const applicationTotal = applications.length;

    // ========== 所要時間の計算 ==========
    // 登録→認証の平均時間（時間単位）
    let avgRegistrationToVerifyHours: number | null = null;
    const verifyDeltas: number[] = [];
    verifiedUsers.forEach(u => {
      if (u.email_verified_at) {
        const delta = u.email_verified_at.getTime() - u.created_at.getTime();
        if (delta >= 0) verifyDeltas.push(delta);
      }
    });
    if (verifyDeltas.length > 0) {
      const avgMs = verifyDeltas.reduce((a, b) => a + b, 0) / verifyDeltas.length;
      avgRegistrationToVerifyHours = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;
    }

    // ========== ブレイクダウン ==========
    let breakdownData: Array<{
      period: string;
      registered: number;
      verified: number;
      searchReached: number;
      jobViewed: number;
      bookmarked: number;
      applied: number;
    }> | null = null;

    if (breakdown === 'daily' || breakdown === 'monthly') {
      const keyFn = breakdown === 'daily' ? toJSTDateStr : toJSTMonthStr;

      const periodMap = new Map<string, {
        registered: Set<number>;
        verified: Set<number>;
        searchReached: Set<number>;
        jobViewed: Set<number>;
        bookmarked: Set<number>;
        applied: Set<number>;
      }>();

      const ensurePeriod = (key: string) => {
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            registered: new Set(),
            verified: new Set(),
            searchReached: new Set(),
            jobViewed: new Set(),
            bookmarked: new Set(),
            applied: new Set(),
          });
        }
        return periodMap.get(key)!;
      };

      // 期間内の全日付/全月を事前にマップに追加（データ0の日も表示するため）
      if (startDate && endDate) {
        const start = new Date(`${startDate}T00:00:00+09:00`);
        const end = new Date(`${endDate}T23:59:59.999+09:00`);
        if (breakdown === 'daily') {
          const cursor = new Date(start);
          while (cursor <= end) {
            ensurePeriod(toJSTDateStr(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
        } else {
          // monthly: 各月の1日を生成
          const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
          const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
          while (cursor <= endMonth) {
            ensurePeriod(toJSTMonthStr(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
          }
        }
      }

      // 登録日ベースでブレイクダウン
      registeredUsers.forEach(u => {
        const key = keyFn(u.created_at);
        ensurePeriod(key).registered.add(u.id);
      });

      // 認証: email_verified_at がある場合はその日付、ない場合は登録日
      verifiedUsers.forEach(u => {
        const date = u.email_verified_at || u.created_at;
        const key = keyFn(date);
        ensurePeriod(key).verified.add(u.id);
      });

      // 求人検索到達
      jobSearchViews.forEach(v => {
        const key = keyFn(v.created_at);
        ensurePeriod(key).searchReached.add(v.user_id);
      });

      // 求人詳細閲覧
      jobDetailViews.forEach(v => {
        const key = keyFn(v.created_at);
        ensurePeriod(key).jobViewed.add(v.user_id);
      });

      // お気に入り
      bookmarks.forEach(b => {
        if (b.user_id !== null) {
          const key = keyFn(b.created_at);
          ensurePeriod(key).bookmarked.add(b.user_id);
        }
      });

      // 応募
      applications.forEach(a => {
        const key = keyFn(a.created_at);
        ensurePeriod(key).applied.add(a.user_id);
      });

      breakdownData = Array.from(periodMap.entries())
        .map(([period, d]) => ({
          period,
          registered: d.registered.size,
          verified: d.verified.size,
          searchReached: d.searchReached.size,
          jobViewed: d.jobViewed.size,
          bookmarked: d.bookmarked.size,
          applied: d.applied.size,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }

    // ========== 流入元別集計（source=all のときのみ） ==========
    let bySource: Array<{
      source: string;
      sourceLabel: string;
      registered: number;
      verified: number;
      searchReached: number;
      jobViewed: number;
      bookmarked: number;
      applied: number;
      conversionRate: number;
    }> | null = null;

    if (source === 'all') {
      const sourceMap = new Map<string, {
        registered: Set<number>;
        verified: Set<number>;
        searchReached: Set<number>;
        jobViewed: Set<number>;
        bookmarked: Set<number>;
        applied: Set<number>;
      }>();

      const ensureSource = (key: string) => {
        if (!sourceMap.has(key)) {
          sourceMap.set(key, {
            registered: new Set(),
            verified: new Set(),
            searchReached: new Set(),
            jobViewed: new Set(),
            bookmarked: new Set(),
            applied: new Set(),
          });
        }
        return sourceMap.get(key)!;
      };

      registeredUsers.forEach(u => {
        const key = u.registration_lp_id || 'direct';
        ensureSource(key).registered.add(u.id);
        if (u.email_verified) {
          ensureSource(key).verified.add(u.id);
        }
      });

      jobSearchViews.forEach(v => {
        const user = registeredUsers.find(u => u.id === v.user_id);
        if (user) {
          const key = user.registration_lp_id || 'direct';
          ensureSource(key).searchReached.add(v.user_id);
        }
      });

      jobDetailViews.forEach(v => {
        const user = registeredUsers.find(u => u.id === v.user_id);
        if (user) {
          const key = user.registration_lp_id || 'direct';
          ensureSource(key).jobViewed.add(v.user_id);
        }
      });

      bookmarks.forEach(b => {
        if (b.user_id !== null) {
          const user = registeredUsers.find(u => u.id === b.user_id);
          if (user) {
            const key = user.registration_lp_id || 'direct';
            ensureSource(key).bookmarked.add(b.user_id!);
          }
        }
      });

      applications.forEach(a => {
        const user = registeredUsers.find(u => u.id === a.user_id);
        if (user) {
          const key = user.registration_lp_id || 'direct';
          ensureSource(key).applied.add(a.user_id);
        }
      });

      // LP名をLandingPageテーブルから取得
      const allLpKeys = Array.from(sourceMap.keys()).filter(k => k !== 'direct');
      const lpNumbers = allLpKeys.map(Number).filter(n => !isNaN(n));
      const landingPages = lpNumbers.length > 0
        ? await prisma.landingPage.findMany({
            where: { lp_number: { in: lpNumbers } },
            select: { lp_number: true, name: true },
          })
        : [];
      const lpNameMap = new Map(landingPages.map(lp => [String(lp.lp_number), lp.name]));

      const sourceLabels: Record<string, string> = {
        'direct': '直接流入',
      };

      bySource = Array.from(sourceMap.entries())
        .map(([key, d]) => {
          const reg = d.registered.size;
          const app = d.applied.size;
          return {
            source: key,
            sourceLabel: sourceLabels[key] || lpNameMap.get(key) || `LP${key}`,
            registered: reg,
            verified: d.verified.size,
            searchReached: d.searchReached.size,
            jobViewed: d.jobViewed.size,
            bookmarked: d.bookmarked.size,
            applied: app,
            conversionRate: reg > 0 ? Math.round((app / reg) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.registered - a.registered);
    }

    // ========== LP一覧（フィルターUI用、常に返す） ==========
    const allLandingPages = await prisma.landingPage.findMany({
      where: { is_published: true },
      select: { lp_number: true, name: true },
      orderBy: { lp_number: 'asc' },
    });
    const lpSources = allLandingPages.map(lp => ({
      value: String(lp.lp_number),
      label: lp.name,
    }));

    // ========== レスポンス ==========
    const overallConversionRate = registeredCount > 0
      ? Math.round((appliedCount / registeredCount) * 1000) / 10
      : 0;

    return NextResponse.json({
      funnel: {
        registered: registeredCount,
        verified: verifiedCount,
        searchReached: searchReachedCount,
        jobViewed: jobViewedCount,
        jobViewedPV: jobViewedPV,
        bookmarked: bookmarkedCount,
        applied: appliedCount,
        applicationTotal: applicationTotal,
      },
      overallConversionRate,
      avgRegistrationToVerifyHours,
      lpSources,
      ...(bySource ? { bySource } : {}),
      ...(breakdownData ? { breakdown: breakdownData } : {}),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Funnel analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}
