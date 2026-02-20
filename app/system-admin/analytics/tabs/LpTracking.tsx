'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BarChart3, Clock, Scroll, ExternalLink, HelpCircle, ChevronDown, ChevronRight, Download, ChevronLeft, Copy, Check, Filter, ArrowRight } from 'lucide-react';

// ジャンル型
type Genre = {
  id: number;
  prefix: string;
  name: string;
};

// 日付ユーティリティ関数
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getSunday = (mondayDate: Date): Date => {
  const d = new Date(mondayDate);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getFirstDayOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getLastDayOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (date: Date): string => {
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatMonthDisplay = (date: Date): string => {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};

type PeriodMode = 'week' | 'month' | 'custom';

interface TrackingData {
  pageViews: Array<{
    lpId: string;
    campaignCode: string | null;
    count: number;
  }>;
  clicks: Array<{
    lpId: string;
    campaignCode: string | null;
    buttonId: string;
    count: number;
  }>;
  uniqueSessions: Array<{
    lpId: string;
    campaignCode: string | null;
    count: number;
  }>;
  dailyPageViews: Array<{
    date: string;
    lpId: string;
    campaignCode: string | null;
    count: number;
  }>;
  registrations?: Array<{
    lpId: string | null;
    campaignCode: string | null;
    count: number;
  }>;
  parentJobStats?: Array<{
    lpId: string;
    campaignCode: string | null;
    pv: number;
    sessions: number;
  }>;
  applicationsByLp?: Array<{
    lpId: string;
    campaignCode: string | null;
    count: number;
    userCount: number;
  }>;
  daysToApplicationByLp?: Array<{
    lpId: string;
    campaignCode: string | null;
    avgDays: number;
  }>;
  engagement?: EngagementData;
}

interface EngagementData {
  distribution: {
    all: { level1: number; level2: number; level3: number; level4: number; level5: number; total: number };
    ctaClicked: { level1: number; level2: number; level3: number; level4: number; level5: number; total: number };
    ctaNotClicked: { level1: number; level2: number; level3: number; level4: number; level5: number; total: number };
  };
  averages: {
    all: { avgDwellTime: number; avgScrollDepth: number; avgEngagementLevel: number; count: number };
    ctaClicked: { avgDwellTime: number; avgScrollDepth: number; avgEngagementLevel: number; count: number };
    ctaNotClicked: { avgDwellTime: number; avgScrollDepth: number; avgEngagementLevel: number; count: number };
  };
  scrollStats: Array<{ lpId: string; scrollDepth: number; count: number }>;
  scrollByCta: Array<{ scrollDepth: number; ctaClicked: boolean; count: number }>;
  dwellStats: Array<{ lpId: string; dwellSeconds: number; count: number }>;
  dwellByCta: Array<{ dwellSeconds: number; ctaClicked: boolean; count: number }>;
  sectionDwells: Array<{ lpId: string; sectionId: string; sectionName: string | null; avgDwellSeconds: number; count: number }>;
  sectionDwellsByCta: Array<{ sectionId: string; sectionName: string | null; ctaClicked: boolean; avgDwellSeconds: number; count: number }>;
}

interface LPConfig {
  [key: string]: {
    title: string;
    isActive?: boolean;
    isDbManaged?: boolean;
    campaigns: Array<{
      code: string;
      name: string;
      createdAt: string;
    }>;
  };
}

// 行データ型
interface RowData {
  id: string;
  type: 'lp' | 'campaign' | 'total';
  lpId: string;
  campaignCode: string | null;
  label: string;
  pv: number;
  sessions: number;
  events: number;
  eventCtr: number;
  registrations: number;
  registrationRate: number;
  parentJobPV: number;
  parentJobSessions: number;
  applicationCount: number;
  applicationRate: number;
  avgDaysToApplication: number;
}

type ViewMode = 'all' | 'ctaClicked' | 'ctaNotClicked' | 'comparison';

// 公開求人サマリー型
interface PublicJobsSummary {
  totalPV: number;
  totalSessions: number;
  jobDetailPV: number;
  ctaClicks: number;
  ctr: number;
  registrations: number;
  cvr: number;
  avgDwellTime: number;
  parentJobPV: number;
  parentJobSessions: number;
  applicationCount: number;
  applicationUserCount: number;
  applicationRate: number;
  avgDaysToApplication: number;
}

export default function LpTracking() {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [lpConfig, setLpConfig] = useState<LPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  // 選択された行（エンゲージメント分析用）- 合計行をデフォルトで選択
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set(['total:all']));
  const [expandedLps, setExpandedLps] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('comparison');
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);
  const [loadingEngagement, setLoadingEngagement] = useState(false);

  // 公開求人サマリー
  const [publicJobsSummary, setPublicJobsSummary] = useState<PublicJobsSummary | null>(null);

  // 期間モード（週 or 月 or カスタム）
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  // 基準日（週モードなら週の月曜日、月モードなら月の1日）
  const [baseDate, setBaseDate] = useState<Date>(() => getMonday(new Date()));
  // エクスポートメニュー
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 日付エラー（開始日 > 終了日）
  const [dateError, setDateError] = useState<string | null>(null);

  // ジャンル一覧とフィルター
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenrePrefix, setSelectedGenrePrefix] = useState<string>('all');

  // エクスポートメニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // 期間の表示ラベル
  const periodLabel = useMemo(() => {
    if (periodMode === 'week') {
      const monday = baseDate;
      const sunday = getSunday(monday);
      return `${formatDateDisplay(monday)} - ${formatDateDisplay(sunday)}`;
    } else if (periodMode === 'month') {
      return formatMonthDisplay(baseDate);
    }
    return 'カスタム期間';
  }, [periodMode, baseDate]);

  // 期間モードに応じて dateRange を更新
  useEffect(() => {
    if (periodMode === 'week') {
      const monday = baseDate;
      const sunday = getSunday(monday);
      setDateRange({
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
      });
    } else if (periodMode === 'month') {
      const firstDay = baseDate;
      const lastDay = getLastDayOfMonth(baseDate);
      setDateRange({
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      });
    }
    // custom モードの場合は dateRange を直接変更するので何もしない
  }, [periodMode, baseDate]);

  // 前の期間へ
  const goToPrevPeriod = useCallback(() => {
    if (periodMode === 'week') {
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() - 7);
      setBaseDate(newDate);
    } else if (periodMode === 'month') {
      const newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setBaseDate(getFirstDayOfMonth(newDate));
    }
  }, [periodMode, baseDate]);

  // 次の期間へ
  const goToNextPeriod = useCallback(() => {
    if (periodMode === 'week') {
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + 7);
      setBaseDate(newDate);
    } else if (periodMode === 'month') {
      const newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setBaseDate(getFirstDayOfMonth(newDate));
    }
  }, [periodMode, baseDate]);

  // 今週/今月に戻る
  const goToCurrentPeriod = useCallback(() => {
    if (periodMode === 'week') {
      setBaseDate(getMonday(new Date()));
    } else if (periodMode === 'month') {
      setBaseDate(getFirstDayOfMonth(new Date()));
    }
  }, [periodMode]);

  // モード切り替え
  const togglePeriodMode = useCallback(() => {
    if (periodMode === 'week') {
      setPeriodMode('month');
      setBaseDate(getFirstDayOfMonth(new Date()));
    } else {
      setPeriodMode('week');
      setBaseDate(getMonday(new Date()));
    }
  }, [periodMode]);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch LP config (no-store to always get fresh data)
      const configRes = await fetch('/api/lp-config', { cache: 'no-store' });
      const configData = await configRes.json();
      setLpConfig(configData);

      // Fetch genres (no-store to always get fresh data)
      const genresRes = await fetch('/api/lp-code-genres', { cache: 'no-store' });
      const genresData = await genresRes.json();
      if (genresData.genres) {
        setGenres(genresData.genres);
      }

      // Fetch tracking data (no-store to always get fresh data)
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);

      const trackingRes = await fetch(`/api/lp-tracking?${params.toString()}`, { cache: 'no-store' });
      const trackingJson = await trackingRes.json();
      setTrackingData(trackingJson);

      // Fetch public jobs summary (same date range)
      const publicJobsParams = new URLSearchParams();
      if (dateRange.startDate) publicJobsParams.set('startDate', dateRange.startDate);
      if (dateRange.endDate) publicJobsParams.set('endDate', dateRange.endDate);

      const publicJobsRes = await fetch(`/api/lp-tracking/public-jobs?${publicJobsParams.toString()}`, { cache: 'no-store' });
      const publicJobsJson = await publicJobsRes.json();
      setPublicJobsSummary(publicJobsJson);
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // エンゲージメントデータを選択された項目でフェッチ
  const fetchEngagementData = async () => {
    if (selectedRows.size === 0) {
      setEngagementData(null);
      return;
    }

    setLoadingEngagement(true);
    try {
      // 選択された行からlpId/campaignCodeのペアを抽出
      const selectedItems = Array.from(selectedRows).map(id => {
        const parts = id.split(':');
        return { lpId: parts[0], campaignCode: parts[1] === 'all' ? null : parts[1] };
      });

      // APIコールでエンゲージメントデータを取得
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
      params.set('includeEngagement', 'true');

      // 最初のLPでフィルタ（複数選択時は全データから計算）
      if (selectedItems.length === 1 && selectedItems[0].lpId !== 'total') {
        params.set('lpId', selectedItems[0].lpId);
      }

      const res = await fetch(`/api/lp-tracking?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setEngagementData(data.engagement || null);
    } catch (error) {
      console.error('Failed to fetch engagement data:', error);
    } finally {
      setLoadingEngagement(false);
    }
  };

  // 選択変更時にエンゲージメントデータを更新
  useEffect(() => {
    if (selectedRows.size > 0) {
      fetchEngagementData();
    } else {
      setEngagementData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRows]);

  const getLpTitle = (lpId: string) => {
    const title = lpConfig?.[lpId]?.title || `LP ${lpId}`;
    return `LP${lpId} ${title}`;
  };

  const getCampaignName = (lpId: string, campaignCode: string | null) => {
    if (!campaignCode) return '(直接アクセス)';
    const campaign = lpConfig?.[lpId]?.campaigns?.find(c => c.code === campaignCode);
    return campaign ? campaign.name : campaignCode;
  };

  // テーブル用データを生成
  const tableData = useMemo<RowData[]>(() => {
    if (!lpConfig) return [];

    const pageViews = trackingData?.pageViews || [];
    const clicks = trackingData?.clicks || [];
    const uniqueSessions = trackingData?.uniqueSessions || [];
    const registrations = trackingData?.registrations || [];

    const parentJobStats = trackingData?.parentJobStats || [];
    const applicationsByLp = trackingData?.applicationsByLp || [];
    const daysToApplicationByLp = trackingData?.daysToApplicationByLp || [];

    // LP別に集計（トラッキングデータから）
    type CampaignStats = { pv: number; sessions: number; clicks: number; registrations: number; parentJobPV: number; parentJobSessions: number; applicationCount: number; applicationUserCount: number; avgDaysToApplication: number };
    const trackingMap = new Map<string, {
      pv: number;
      sessions: number;
      clicks: number;
      registrations: number;
      parentJobPV: number;
      parentJobSessions: number;
      applicationCount: number;
      applicationUserCount: number;
      avgDaysToApplication: number;
      campaigns: Map<string, CampaignStats>;
    }>();

    pageViews.forEach(pv => {
      if (!trackingMap.has(pv.lpId)) {
        trackingMap.set(pv.lpId, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0, campaigns: new Map() });
      }
      const lp = trackingMap.get(pv.lpId)!;
      lp.pv += pv.count;

      const campaignKey = pv.campaignCode || 'direct';
      if (!lp.campaigns.has(campaignKey)) {
        lp.campaigns.set(campaignKey, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0 });
      }
      lp.campaigns.get(campaignKey)!.pv += pv.count;
    });

    uniqueSessions.forEach(s => {
      if (!trackingMap.has(s.lpId)) {
        trackingMap.set(s.lpId, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0, campaigns: new Map() });
      }
      const lp = trackingMap.get(s.lpId)!;
      lp.sessions += s.count;
      const campaignKey = s.campaignCode || 'direct';
      if (!lp.campaigns.has(campaignKey)) {
        lp.campaigns.set(campaignKey, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0 });
      }
      lp.campaigns.get(campaignKey)!.sessions += s.count;
    });

    clicks.forEach(c => {
      if (!trackingMap.has(c.lpId)) {
        trackingMap.set(c.lpId, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0, campaigns: new Map() });
      }
      const lp = trackingMap.get(c.lpId)!;
      lp.clicks += c.count;
      const campaignKey = c.campaignCode || 'direct';
      if (!lp.campaigns.has(campaignKey)) {
        lp.campaigns.set(campaignKey, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0 });
      }
      lp.campaigns.get(campaignKey)!.clicks += c.count;
    });

    // 登録数を集計
    registrations.forEach(r => {
      if (!r.lpId) return;
      if (!trackingMap.has(r.lpId)) {
        trackingMap.set(r.lpId, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0, campaigns: new Map() });
      }
      const lp = trackingMap.get(r.lpId)!;
      lp.registrations += r.count;
      const campaignKey = r.campaignCode || 'direct';
      if (!lp.campaigns.has(campaignKey)) {
        lp.campaigns.set(campaignKey, { pv: 0, sessions: 0, clicks: 0, registrations: 0, parentJobPV: 0, parentJobSessions: 0, applicationCount: 0, applicationUserCount: 0, avgDaysToApplication: 0 });
      }
      lp.campaigns.get(campaignKey)!.registrations += r.count;
    });

    // 親求人PV/セッション集計
    parentJobStats.forEach(ps => {
      if (!trackingMap.has(ps.lpId)) return;
      const lp = trackingMap.get(ps.lpId)!;
      lp.parentJobPV += ps.pv;
      lp.parentJobSessions += ps.sessions;
      const campaignKey = ps.campaignCode || 'direct';
      if (lp.campaigns.has(campaignKey)) {
        lp.campaigns.get(campaignKey)!.parentJobPV += ps.pv;
        lp.campaigns.get(campaignKey)!.parentJobSessions += ps.sessions;
      }
    });

    // 応募数集計
    applicationsByLp.forEach(app => {
      if (!trackingMap.has(app.lpId)) return;
      const lp = trackingMap.get(app.lpId)!;
      lp.applicationCount += app.count;
      lp.applicationUserCount += (app.userCount || 0);
      const campaignKey = app.campaignCode || 'direct';
      if (lp.campaigns.has(campaignKey)) {
        lp.campaigns.get(campaignKey)!.applicationCount += app.count;
        lp.campaigns.get(campaignKey)!.applicationUserCount += (app.userCount || 0);
      }
    });

    // 平均応募日数集計
    daysToApplicationByLp.forEach(d => {
      if (!trackingMap.has(d.lpId)) return;
      const lp = trackingMap.get(d.lpId)!;
      lp.avgDaysToApplication = d.avgDays;
      const campaignKey = d.campaignCode || 'direct';
      if (lp.campaigns.has(campaignKey)) {
        lp.campaigns.get(campaignKey)!.avgDaysToApplication = d.avgDays;
      }
    });

    // 行データ生成 - 有効なLPをすべて表示（データがなくても）
    const rows: RowData[] = [];
    let totalPv = 0, totalSessions = 0, totalClicks = 0, totalRegistrations = 0;
    let totalParentJobPV = 0, totalParentJobSessions = 0, totalApplicationCount = 0, totalApplicationUserCount = 0;

    // DB管理LPのみを表示（isDbManaged=true）。DB管理LPがない場合は全LP表示（後方互換）
    // genresなど非LPキーを除外（数値IDのキーのみ対象）
    const lpKeys = Object.keys(lpConfig).filter(key => /^\d+$/.test(key));
    const hasDbManagedLps = lpKeys.some(lpId => lpConfig[lpId]?.isDbManaged);
    const activeLpIds = lpKeys
      .filter(lpId => {
        const lp = lpConfig[lpId];
        if (!lp) return false;
        if (hasDbManagedLps) {
          return lp.isDbManaged && lp.isActive !== false;
        }
        return lp.isActive !== false;
      })
      .sort((a, b) => parseInt(a) - parseInt(b));

    activeLpIds.forEach((lpId) => {
      const lpData = lpConfig[lpId];
      const tracking = trackingMap.get(lpId);
      const pv = tracking?.pv || 0;
      const sessions = tracking?.sessions || 0;
      const clickCount = tracking?.clicks || 0;
      const regCount = tracking?.registrations || 0;
      const pjPV = tracking?.parentJobPV || 0;
      const pjSessions = tracking?.parentJobSessions || 0;
      const appCount = tracking?.applicationCount || 0;
      const appUserCount = tracking?.applicationUserCount || 0;
      const appDays = tracking?.avgDaysToApplication || 0;

      totalPv += pv;
      totalSessions += sessions;
      totalClicks += clickCount;
      totalRegistrations += regCount;
      totalParentJobPV += pjPV;
      totalParentJobSessions += pjSessions;
      totalApplicationCount += appCount;
      totalApplicationUserCount += appUserCount;

      // LP行
      rows.push({
        id: `${lpId}:all`,
        type: 'lp',
        lpId,
        campaignCode: null,
        label: `LP${lpId} ${lpData.title || ''}`.trim(),
        pv,
        sessions,
        events: clickCount,
        eventCtr: sessions > 0 ? (clickCount / sessions) * 100 : 0,
        registrations: regCount,
        registrationRate: sessions > 0 ? (regCount / sessions) * 100 : 0,
        parentJobPV: pjPV,
        parentJobSessions: pjSessions,
        applicationCount: appCount,
        applicationRate: regCount > 0 ? (appUserCount / regCount) * 100 : 0,
        avgDaysToApplication: appDays,
      });

      // キャンペーン行（設定されているキャンペーン + 直接アクセス）
      const campaigns = lpData.campaigns || [];
      const trackingCampaigns = tracking?.campaigns || new Map();

      // 直接アクセスがある場合は追加
      if (trackingCampaigns.has('direct')) {
        const directData = trackingCampaigns.get('direct')!;
        rows.push({
          id: `${lpId}:direct`,
          type: 'campaign',
          lpId,
          campaignCode: null,
          label: '(直接アクセス)',
          pv: directData.pv,
          sessions: directData.sessions,
          events: directData.clicks,
          eventCtr: directData.sessions > 0 ? (directData.clicks / directData.sessions) * 100 : 0,
          registrations: directData.registrations,
          registrationRate: directData.sessions > 0 ? (directData.registrations / directData.sessions) * 100 : 0,
          parentJobPV: directData.parentJobPV,
          parentJobSessions: directData.parentJobSessions,
          applicationCount: directData.applicationCount,
          applicationRate: directData.registrations > 0 ? (directData.applicationUserCount / directData.registrations) * 100 : 0,
          avgDaysToApplication: directData.avgDaysToApplication,
        });
      }

      // 設定されているキャンペーン
      campaigns.forEach((campaign) => {
        const campaignTracking = trackingCampaigns.get(campaign.code);
        const campSessions = campaignTracking?.sessions || 0;
        const campRegs = campaignTracking?.registrations || 0;
        const campAppCount = campaignTracking?.applicationCount || 0;
        const campAppUserCount = campaignTracking?.applicationUserCount || 0;
        rows.push({
          id: `${lpId}:${campaign.code}`,
          type: 'campaign',
          lpId,
          campaignCode: campaign.code,
          label: campaign.name || campaign.code,
          pv: campaignTracking?.pv || 0,
          sessions: campSessions,
          events: campaignTracking?.clicks || 0,
          eventCtr: campSessions > 0
            ? ((campaignTracking?.clicks || 0) / campSessions) * 100
            : 0,
          registrations: campRegs,
          registrationRate: campSessions > 0 ? (campRegs / campSessions) * 100 : 0,
          parentJobPV: campaignTracking?.parentJobPV || 0,
          parentJobSessions: campaignTracking?.parentJobSessions || 0,
          applicationCount: campAppCount,
          applicationRate: campRegs > 0 ? (campAppUserCount / campRegs) * 100 : 0,
          avgDaysToApplication: campaignTracking?.avgDaysToApplication || 0,
        });
      });
    });

    // 合計行を先頭に
    rows.unshift({
      id: 'total:all',
      type: 'total',
      lpId: 'total',
      campaignCode: null,
      label: '合計',
      pv: totalPv,
      sessions: totalSessions,
      events: totalClicks,
      eventCtr: totalSessions > 0 ? (totalClicks / totalSessions) * 100 : 0,
      registrations: totalRegistrations,
      registrationRate: totalSessions > 0 ? (totalRegistrations / totalSessions) * 100 : 0,
      parentJobPV: totalParentJobPV,
      parentJobSessions: totalParentJobSessions,
      applicationCount: totalApplicationCount,
      applicationRate: totalRegistrations > 0 ? (totalApplicationUserCount / totalRegistrations) * 100 : 0,
      avgDaysToApplication: 0,
    });

    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingData, lpConfig]);

  // ジャンルフィルター適用後のテーブルデータ
  const filteredTableData = useMemo<RowData[]>(() => {
    if (selectedGenrePrefix === 'all') {
      return tableData;
    }

    // 合計行は常に表示（フィルター後の合計を再計算）
    const filteredRows: RowData[] = [];
    let totalPv = 0, totalSessions = 0, totalClicks = 0, totalRegistrations = 0;
    let totalParentJobPV = 0, totalParentJobSessions = 0, totalApplicationCount = 0, totalApplicationUserCount = 0;

    // キャンペーンコードがジャンルプレフィックスで始まるかチェック
    const matchesGenre = (campaignCode: string | null) => {
      if (!campaignCode) return false;
      return campaignCode.startsWith(`${selectedGenrePrefix}-`);
    };

    tableData.forEach(row => {
      if (row.type === 'total') {
        // 合計行はスキップ（後で再計算）
        return;
      }

      if (row.type === 'lp') {
        // LP行の場合、そのLPにフィルター対象のキャンペーンがあるかチェック
        const lpCampaigns = tableData.filter(
          r => r.type === 'campaign' && r.lpId === row.lpId && matchesGenre(r.campaignCode)
        );
        if (lpCampaigns.length > 0) {
          // フィルター対象のキャンペーンがあるLPを表示（LP行の数値はフィルター対象分のみ）
          const filteredPv = lpCampaigns.reduce((sum, c) => sum + c.pv, 0);
          const filteredSessions = lpCampaigns.reduce((sum, c) => sum + c.sessions, 0);
          const filteredEvents = lpCampaigns.reduce((sum, c) => sum + c.events, 0);
          const filteredRegs = lpCampaigns.reduce((sum, c) => sum + c.registrations, 0);
          const filteredPJPV = lpCampaigns.reduce((sum, c) => sum + c.parentJobPV, 0);
          const filteredPJSessions = lpCampaigns.reduce((sum, c) => sum + c.parentJobSessions, 0);
          const filteredAppCount = lpCampaigns.reduce((sum, c) => sum + c.applicationCount, 0);

          totalPv += filteredPv;
          totalSessions += filteredSessions;
          totalClicks += filteredEvents;
          totalRegistrations += filteredRegs;
          totalParentJobPV += filteredPJPV;
          totalParentJobSessions += filteredPJSessions;
          totalApplicationCount += filteredAppCount;

          filteredRows.push({
            ...row,
            pv: filteredPv,
            sessions: filteredSessions,
            events: filteredEvents,
            eventCtr: filteredSessions > 0 ? (filteredEvents / filteredSessions) * 100 : 0,
            registrations: filteredRegs,
            registrationRate: filteredSessions > 0 ? (filteredRegs / filteredSessions) * 100 : 0,
            parentJobPV: filteredPJPV,
            parentJobSessions: filteredPJSessions,
            applicationCount: filteredAppCount,
            // ジャンルフィルター時はキャンペーン間のユニークユーザー重複を考慮できないため応募総数ベースで近似
            applicationRate: filteredRegs > 0 ? (filteredAppCount / filteredRegs) * 100 : 0,
          });
        }
      }

      if (row.type === 'campaign' && matchesGenre(row.campaignCode)) {
        filteredRows.push(row);
      }
    });

    // フィルター後の合計行を先頭に追加
    filteredRows.unshift({
      id: 'total:all',
      type: 'total',
      lpId: 'total',
      campaignCode: null,
      label: '合計',
      pv: totalPv,
      sessions: totalSessions,
      events: totalClicks,
      eventCtr: totalSessions > 0 ? (totalClicks / totalSessions) * 100 : 0,
      registrations: totalRegistrations,
      registrationRate: totalSessions > 0 ? (totalRegistrations / totalSessions) * 100 : 0,
      parentJobPV: totalParentJobPV,
      parentJobSessions: totalParentJobSessions,
      applicationCount: totalApplicationCount,
      applicationRate: totalRegistrations > 0 ? (totalApplicationUserCount / totalRegistrations) * 100 : 0,
      avgDaysToApplication: 0,
    });

    return filteredRows;
  }, [tableData, selectedGenrePrefix]);

  // LP展開/折りたたみ
  const toggleLpExpand = (lpId: string) => {
    const newExpanded = new Set(expandedLps);
    if (newExpanded.has(lpId)) {
      newExpanded.delete(lpId);
    } else {
      newExpanded.add(lpId);
    }
    setExpandedLps(newExpanded);
  };

  // リセット
  const handleReset = () => {
    setPeriodMode('week');
    setBaseDate(getMonday(new Date()));
    setExpandedLps(new Set());
    setEngagementData(null);
    setSelectedGenrePrefix('all');
  };

  // DL可能かどうか
  const canExport = selectedRows.size > 0 && dateRange.startDate && dateRange.endDate;

  // 選択された行のデータを取得
  const getSelectedData = useCallback(() => {
    // 選択されたLP/キャンペーンの行を取得（キャンペーン行も親LPが選択されていれば含める）
    const selectedLpIds = new Set<string>();
    selectedRows.forEach(id => {
      const [lpId] = id.split(':');
      selectedLpIds.add(lpId);
    });

    return filteredTableData.filter(row => {
      // 合計行は選択されていれば含める
      if (row.type === 'total') {
        return selectedRows.has(row.id);
      }
      // LP行は選択されていれば含める
      if (row.type === 'lp') {
        return selectedRows.has(row.id);
      }
      // キャンペーン行は親LPが選択されていれば含める
      if (row.type === 'campaign') {
        return selectedRows.has(`${row.lpId}:all`) || selectedRows.has(row.id);
      }
      return false;
    });
  }, [filteredTableData, selectedRows]);

  // CSVダウンロード
  const downloadCSV = useCallback(() => {
    if (!canExport) return;

    const selectedData = getSelectedData();
    if (selectedData.length === 0) return;

    const headers = ['種別', 'LP/キャンペーン', 'PV', 'セッション', 'イベント', 'イベントCTR', '登録', '登録率', '親求人PV', '親求人セッション', '応募数', '応募率', '平均応募日数'];
    const rows = selectedData.map(row => [
      row.type === 'total' ? '合計' : row.type === 'lp' ? 'LP' : 'キャンペーン',
      row.label,
      row.pv,
      row.sessions,
      row.events,
      `${row.eventCtr.toFixed(1)}%`,
      row.registrations,
      `${row.registrationRate.toFixed(1)}%`,
      row.parentJobPV,
      row.parentJobSessions,
      row.applicationCount,
      `${row.applicationRate.toFixed(1)}%`,
      row.avgDaysToApplication,
    ]);

    const csvContent = [
      `# LPトラッキングレポート`,
      `# 期間: ${dateRange.startDate} ～ ${dateRange.endDate}`,
      `# 出力日時: ${new Date().toLocaleString('ja-JP')}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lp-tracking-${dateRange.startDate}-${dateRange.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [canExport, getSelectedData, dateRange]);

  // テキストをクリップボードにコピー
  const copyToClipboard = useCallback(() => {
    if (!canExport) return;

    const selectedData = getSelectedData();
    if (selectedData.length === 0) return;

    const lines = [
      `LPトラッキングレポート`,
      `期間: ${dateRange.startDate} ～ ${dateRange.endDate}`,
      '',
      'LP/キャンペーン\tPV\tセッション\tイベント\tイベントCTR\t登録\t登録率\t親求人PV\t親求人セッション\t応募数\t応募率\t平均応募日数',
      ...selectedData.map(row => {
        const prefix = row.type === 'campaign' ? '  └ ' : '';
        return `${prefix}${row.label}\t${row.pv}\t${row.sessions}\t${row.events}\t${row.eventCtr.toFixed(1)}%\t${row.registrations}\t${row.registrationRate.toFixed(1)}%\t${row.parentJobPV}\t${row.parentJobSessions}\t${row.applicationCount}\t${row.applicationRate.toFixed(1)}%\t${row.avgDaysToApplication}`;
      }),
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowExportMenu(false);
    });
  }, [canExport, getSelectedData, dateRange]);

  // Helper: Calculate scroll rate by CTA status
  const getScrollRate = (depth: number, category: 'all' | 'ctaClicked' | 'ctaNotClicked') => {
    if (!engagementData) return 0;
    const total = engagementData.averages[category].count;
    if (total === 0) return 0;

    if (category === 'all') {
      const scrollData = engagementData.scrollStats.find(s => s.scrollDepth === depth);
      return scrollData ? Math.round((scrollData.count / total) * 100) : 0;
    } else {
      const scrollData = engagementData.scrollByCta.find(
        s => s.scrollDepth === depth && s.ctaClicked === (category === 'ctaClicked')
      );
      return scrollData ? Math.round((scrollData.count / engagementData.averages[category].count) * 100) : 0;
    }
  };

  // Helper: Calculate dwell rate by CTA status
  const getDwellRate = (seconds: number, category: 'all' | 'ctaClicked' | 'ctaNotClicked') => {
    if (!engagementData) return 0;
    const total = engagementData.averages[category].count;
    if (total === 0) return 0;

    if (category === 'all') {
      const dwellData = engagementData.dwellStats.find(d => d.dwellSeconds === seconds);
      return dwellData ? Math.round((dwellData.count / total) * 100) : 0;
    } else {
      const dwellData = engagementData.dwellByCta.find(
        d => d.dwellSeconds === seconds && d.ctaClicked === (category === 'ctaClicked')
      );
      return dwellData ? Math.round((dwellData.count / engagementData.averages[category].count) * 100) : 0;
    }
  };

  // Helper: Get section dwell time by CTA status
  const getSectionDwell = (sectionId: string, category: 'all' | 'ctaClicked' | 'ctaNotClicked') => {
    if (!engagementData) return 0;
    if (category === 'all') {
      const section = engagementData.sectionDwells.find(s => s.sectionId === sectionId);
      return section ? Math.round(section.avgDwellSeconds) : 0;
    } else {
      const section = engagementData.sectionDwellsByCta.find(
        s => s.sectionId === sectionId && s.ctaClicked === (category === 'ctaClicked')
      );
      return section ? Math.round(section.avgDwellSeconds) : 0;
    }
  };

  // Get unique section IDs
  const sectionIds = engagementData
    ? Array.from(new Set(engagementData.sectionDwells.map(s => s.sectionId)))
    : [];

  const getSectionName = (sectionId: string) => {
    const section = engagementData?.sectionDwells.find(s => s.sectionId === sectionId);
    return section?.sectionName || sectionId;
  };

  // Progress bar component
  const ProgressBar = ({ value, maxValue = 100, color = 'blue' }: { value: number; maxValue?: number; color?: string }) => {
    const percentage = Math.min((value / maxValue) * 100, 100);
    const colorClasses: Record<string, string> = {
      blue: 'bg-indigo-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
    };
    return (
      <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${colorClasses[color] || 'bg-indigo-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  // Comparison table cell
  const ComparisonCell = ({ values }: { values: { all: number | string; ctaClicked: number | string; ctaNotClicked: number | string } }) => {
    if (viewMode === 'comparison') {
      return (
        <div className="flex gap-4">
          <span className="text-slate-900 min-w-[60px]">{values.all}</span>
          <span className="text-green-600 min-w-[60px]">{values.ctaClicked}</span>
          <span className="text-red-600 min-w-[60px]">{values.ctaNotClicked}</span>
        </div>
      );
    }
    return <span>{values[viewMode]}</span>;
  };

  return (
    <div>
        {/* ツールバー: トラッキング仕様リンク + エクスポート */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">LP別のアクセス数・エンゲージメントを分析できます</p>
          <div className="flex items-center gap-3">
            <Link
              href="/system-admin/lp/tracking/spec"
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <HelpCircle className="w-4 h-4" />
              トラッキング仕様
            </Link>
            {/* エクスポートボタン */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => canExport && setShowExportMenu(!showExportMenu)}
                disabled={!canExport}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  canExport
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title={!canExport ? 'DLしたいデータをテーブルで選択してください' : `選択中: ${selectedRows.size}件`}
              >
                <Download className="w-4 h-4" />
                エクスポート
                {canExport && (
                  <span className="bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedRows.size}
                  </span>
                )}
              </button>
              {showExportMenu && canExport && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 z-10 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs text-slate-500">
                      {dateRange.startDate} 〜 {dateRange.endDate}
                    </p>
                    <p className="text-xs text-slate-500">{selectedRows.size}件選択中</p>
                  </div>
                  <button
                    onClick={downloadCSV}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-medium">CSVダウンロード</div>
                      <div className="text-xs text-slate-400">Excel・スプレッドシート用</div>
                    </div>
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-100"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium text-green-600">コピーしました</div>
                          <div className="text-xs text-slate-400">クリップボードに保存済み</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-medium">テキストをコピー</div>
                          <div className="text-xs text-slate-400">Slack・メール用</div>
                        </div>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters - 1行構成 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* 期間クイック選択 */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setPeriodMode('week');
                  setBaseDate(getMonday(new Date()));
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  periodMode === 'week'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                週
              </button>
              <button
                onClick={() => {
                  setPeriodMode('month');
                  setBaseDate(getFirstDayOfMonth(new Date()));
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  periodMode === 'month'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                月
              </button>
            </div>

            {/* 期間ナビゲーション */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
              <button
                onClick={goToPrevPeriod}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToCurrentPeriod}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 min-w-[120px] text-center"
              >
                {periodLabel}
              </button>
              <button
                onClick={goToNextPeriod}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 区切り線 */}
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            {/* カスタム日付 */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setPeriodMode('custom');
                  setDateRange(prev => {
                    if (newStart && prev.endDate && newStart > prev.endDate) {
                      setDateError('開始日は終了日より前にしてください');
                    } else {
                      setDateError(null);
                    }
                    return { ...prev, startDate: newStart };
                  });
                }}
                className={`border rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  dateError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              <span className="text-slate-400">〜</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => {
                  const newEnd = e.target.value;
                  setPeriodMode('custom');
                  setDateRange(prev => {
                    if (prev.startDate && newEnd && prev.startDate > newEnd) {
                      setDateError('終了日は開始日より後にしてください');
                    } else {
                      setDateError(null);
                    }
                    return { ...prev, endDate: newEnd };
                  });
                }}
                className={`border rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  dateError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {dateError && (
                <span className="text-red-500 text-xs whitespace-nowrap">{dateError}</span>
              )}
            </div>

            {/* 区切り線 */}
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            {/* コードフィルター */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">コード:</span>
              <select
                value={selectedGenrePrefix}
                onChange={(e) => setSelectedGenrePrefix(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
              >
                <option value="all">すべて</option>
                {genres.map((genre) => (
                  <option key={genre.prefix} value={genre.prefix}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </div>

            {/* リセット */}
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              リセット
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
            <p className="mt-2 text-slate-600">読み込み中...</p>
          </div>
        ) : (
          <>
            {/* 公開求人アクセス状況サマリー */}
            {publicJobsSummary && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">公開求人</h2>
                    <Link
                      href="/system-admin/lp/tracking/public-jobs"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      詳細
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ソース</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">PV</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">セッション</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">求人閲覧</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">CTAクリック</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">CTR</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">登録</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">登録率</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">親求人PV</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">親求人セッション</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">応募数</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">応募率</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">平均応募日数</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-indigo-50 font-semibold">
                        <td className="px-4 py-3 text-sm text-slate-900">合計</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.totalPV.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.totalSessions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.jobDetailPV.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.ctaClicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.ctr}%</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.registrations.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.cvr}%</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{(publicJobsSummary.parentJobPV || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{(publicJobsSummary.parentJobSessions || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{(publicJobsSummary.applicationCount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.applicationRate || 0}%</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{publicJobsSummary.avgDaysToApplication || 0}日</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LP/Campaign Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">LP別アクセス状況</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-10">選択</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">LP / キャンペーン</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">PV</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">セッション</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">イベント</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">イベントCTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">登録</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">登録率</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">親求人PV</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">親求人セッション</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">応募数</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">応募率</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">平均応募日数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTableData.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-6 py-8 text-center text-slate-500">
                          {selectedGenrePrefix !== 'all'
                            ? `「${genres.find(g => g.prefix === selectedGenrePrefix)?.name || selectedGenrePrefix}」のデータがありません`
                            : 'トラッキングデータがありません'
                          }
                        </td>
                      </tr>
                    ) : (
                      filteredTableData.map((row) => {
                        // キャンペーン行は親LPが展開されている場合のみ表示
                        if (row.type === 'campaign') {
                          if (!expandedLps.has(row.lpId)) return null;
                          return (
                            <tr key={row.id} className="bg-slate-50">
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(row.id)}
                                  onChange={() => {
                                    const newSelected = new Set(selectedRows);
                                    if (newSelected.has(row.id)) {
                                      newSelected.delete(row.id);
                                    } else {
                                      newSelected.add(row.id);
                                    }
                                    setSelectedRows(newSelected);
                                  }}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 pl-10">
                                └ {row.label}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.pv.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.sessions.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.events.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.eventCtr.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.registrations.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.registrationRate.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.parentJobPV.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.parentJobSessions.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.applicationCount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.applicationRate.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.avgDaysToApplication}日</td>
                            </tr>
                          );
                        }

                        // LP行または合計行
                        const isTotal = row.type === 'total';
                        const isLp = row.type === 'lp';
                        const hasChildren = isLp && filteredTableData.some(r => r.type === 'campaign' && r.lpId === row.lpId);
                        const isExpanded = expandedLps.has(row.lpId);

                        return (
                          <tr key={row.id} className={isTotal ? 'bg-indigo-50 font-semibold' : 'font-medium'}>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRows.has(row.id)}
                                onChange={() => {
                                  const newSelected = new Set(selectedRows);
                                  if (newSelected.has(row.id)) {
                                    newSelected.delete(row.id);
                                  } else {
                                    newSelected.add(row.id);
                                  }
                                  setSelectedRows(newSelected);
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900">
                              <div className="flex items-center gap-2">
                                {hasChildren && (
                                  <button
                                    onClick={() => toggleLpExpand(row.lpId)}
                                    className="p-0.5 hover:bg-slate-200 rounded"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-500" />
                                    )}
                                  </button>
                                )}
                                {!hasChildren && <span className="w-5" />}
                                {row.label}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.pv.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.sessions.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.events.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.eventCtr.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.registrations.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.registrationRate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.parentJobPV.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.parentJobSessions.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.applicationCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.applicationRate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right">{row.avgDaysToApplication}日</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Engagement Analysis Section */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    エンゲージメント分析
                  </h2>
                    <div className="flex gap-2">
                      {(['all', 'ctaClicked', 'ctaNotClicked', 'comparison'] as ViewMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          className={`px-3 py-1.5 text-sm rounded-md ${
                            viewMode === mode
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {mode === 'all' && '全体'}
                          {mode === 'ctaClicked' && 'CTAあり'}
                          {mode === 'ctaNotClicked' && 'CTAなし'}
                          {mode === 'comparison' && '比較'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {viewMode === 'comparison' && (
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-slate-600">■ 全体</span>
                      <span className="text-green-600">■ CTAクリックあり</span>
                      <span className="text-red-600">■ CTAクリックなし</span>
                    </div>
                  )}
                </div>

                {loadingEngagement ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 mx-auto"></div>
                    <p className="mt-2 text-sm text-slate-600">エンゲージメントデータを読み込み中...</p>
                  </div>
                ) : engagementData ? (
                  <div className="p-6 space-y-8">
                    {/* Average Summary - 一番上に配置 */}
                    <div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="text-left py-2">平均値サマリー</th>
                              {viewMode === 'comparison' ? (
                                <>
                                  <th className="text-right py-2">全体</th>
                                  <th className="text-right py-2 text-green-600">CTAあり</th>
                                  <th className="text-right py-2 text-red-600">CTAなし</th>
                                </>
                              ) : (
                                <th className="text-right py-2">値</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-2">平均滞在時間</td>
                              {viewMode === 'comparison' ? (
                                <>
                                  <td className="text-right py-2">{engagementData.averages.all.avgDwellTime}秒</td>
                                  <td className="text-right py-2 text-green-600">{engagementData.averages.ctaClicked.avgDwellTime}秒</td>
                                  <td className="text-right py-2 text-red-600">{engagementData.averages.ctaNotClicked.avgDwellTime}秒</td>
                                </>
                              ) : (
                                <td className="text-right py-2">{engagementData.averages[viewMode].avgDwellTime}秒</td>
                              )}
                            </tr>
                            <tr>
                              <td className="py-2">平均スクロール深度</td>
                              {viewMode === 'comparison' ? (
                                <>
                                  <td className="text-right py-2">{engagementData.averages.all.avgScrollDepth}%</td>
                                  <td className="text-right py-2 text-green-600">{engagementData.averages.ctaClicked.avgScrollDepth}%</td>
                                  <td className="text-right py-2 text-red-600">{engagementData.averages.ctaNotClicked.avgScrollDepth}%</td>
                                </>
                              ) : (
                                <td className="text-right py-2">{engagementData.averages[viewMode].avgScrollDepth}%</td>
                              )}
                            </tr>
                            <tr>
                              <td className="py-2">平均エンゲージメントLv</td>
                              {viewMode === 'comparison' ? (
                                <>
                                  <td className="text-right py-2">{engagementData.averages.all.avgEngagementLevel}</td>
                                  <td className="text-right py-2 text-green-600">{engagementData.averages.ctaClicked.avgEngagementLevel}</td>
                                  <td className="text-right py-2 text-red-600">{engagementData.averages.ctaNotClicked.avgEngagementLevel}</td>
                                </>
                              ) : (
                                <td className="text-right py-2">{engagementData.averages[viewMode].avgEngagementLevel}</td>
                              )}
                            </tr>
                            <tr className="text-slate-400 text-xs">
                              <td className="py-2">サンプル数</td>
                              {viewMode === 'comparison' ? (
                                <>
                                  <td className="text-right py-2">{engagementData.averages.all.count}人</td>
                                  <td className="text-right py-2">{engagementData.averages.ctaClicked.count}人</td>
                                  <td className="text-right py-2">{engagementData.averages.ctaNotClicked.count}人</td>
                                </>
                              ) : (
                                <td className="text-right py-2">{engagementData.averages[viewMode].count}人</td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Scroll Reach Rate */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        <Scroll className="w-4 h-4" />
                        スクロール到達率
                      </h3>
                      <div className="space-y-3">
                        {[25, 50, 75, 90].map((depth) => (
                          <div key={depth} className="flex items-center gap-4">
                            <span className="text-sm text-slate-600 w-20">{depth}%到達</span>
                            <div className="flex-1">
                              <ProgressBar value={getScrollRate(depth, viewMode === 'comparison' ? 'all' : viewMode)} />
                            </div>
                            <ComparisonCell
                              values={{
                                all: `${getScrollRate(depth, 'all')}%`,
                                ctaClicked: `${getScrollRate(depth, 'ctaClicked')}%`,
                                ctaNotClicked: `${getScrollRate(depth, 'ctaNotClicked')}%`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dwell Time Rate */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        滞在時間達成率
                      </h3>
                      <div className="space-y-3">
                        {[5, 10].map((seconds) => (
                          <div key={seconds} className="flex items-center gap-4">
                            <span className="text-sm text-slate-600 w-20">{seconds}秒以上</span>
                            <div className="flex-1">
                              <ProgressBar value={getDwellRate(seconds, viewMode === 'comparison' ? 'all' : viewMode)} color="green" />
                            </div>
                            <ComparisonCell
                              values={{
                                all: `${getDwellRate(seconds, 'all')}%`,
                                ctaClicked: `${getDwellRate(seconds, 'ctaClicked')}%`,
                                ctaNotClicked: `${getDwellRate(seconds, 'ctaNotClicked')}%`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Engagement Level Distribution */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-3">エンゲージメントレベル分布</h3>
                      <div className="space-y-3">
                        {[
                          { level: 1, label: 'Level 1 (5秒滞在)' },
                          { level: 2, label: 'Level 2 (10秒滞在)' },
                          { level: 3, label: 'Level 3 (10秒+50%)' },
                          { level: 4, label: 'Level 4 (10秒+75%)' },
                          { level: 5, label: 'Level 5 (10秒+90%)' },
                        ].map(({ level, label }) => {
                          const levelKey = `level${level}` as 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
                          return (
                            <div key={level} className="flex items-center gap-4">
                              <span className="text-sm text-slate-600 w-32">{label}</span>
                              <div className="flex-1">
                                <ProgressBar
                                  value={engagementData.distribution.all[levelKey]}
                                  maxValue={Math.max(engagementData.distribution.all.total, 1)}
                                  color="purple"
                                />
                              </div>
                              <ComparisonCell
                                values={{
                                  all: `${engagementData.distribution.all[levelKey]}人`,
                                  ctaClicked: `${engagementData.distribution.ctaClicked[levelKey]}人`,
                                  ctaNotClicked: `${engagementData.distribution.ctaNotClicked[levelKey]}人`,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section Dwell Time (Heatspot) */}
                    {sectionIds.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-3">セクション別滞在時間（ヒートスポット）</h3>
                        <div className="space-y-3">
                          {sectionIds.map((sectionId) => {
                            const maxDwell = Math.max(
                              ...sectionIds.map(id => getSectionDwell(id, 'all')),
                              1
                            );
                            return (
                              <div key={sectionId} className="flex items-center gap-4">
                                <span className="text-sm text-slate-600 w-32 truncate" title={getSectionName(sectionId)}>
                                  {getSectionName(sectionId)}
                                </span>
                                <div className="flex-1">
                                  <ProgressBar
                                    value={getSectionDwell(sectionId, viewMode === 'comparison' ? 'all' : viewMode)}
                                    maxValue={maxDwell}
                                    color="orange"
                                  />
                                </div>
                                <ComparisonCell
                                  values={{
                                    all: `${getSectionDwell(sectionId, 'all')}秒`,
                                    ctaClicked: `${getSectionDwell(sectionId, 'ctaClicked')}秒`,
                                    ctaNotClicked: `${getSectionDwell(sectionId, 'ctaNotClicked')}秒`,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Clarity Link */}
                    <div className="pt-4 border-t border-slate-200">
                      <a
                        href="https://clarity.microsoft.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Clarityで詳細なヒートマップを見る
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <p className="text-xs text-slate-500 mt-1">
                        ピクセル単位のヒートマップやセッション録画はMicrosoft Clarityで確認できます
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    エンゲージメントデータがありません
                  </div>
                )}
              </div>
          </>
        )}
    </div>
  );
}
