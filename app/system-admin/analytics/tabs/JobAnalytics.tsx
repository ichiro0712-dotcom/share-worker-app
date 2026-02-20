'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

// 日付ユーティリティ
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

const getFirstDayOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1);
};

const getLastDayOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const formatMonthDisplay = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月`;
const formatYearDisplay = (date: Date): string => `${date.getFullYear()}年`;

// アクセス状況の期間モード
type AccessPeriodMode = 'daily' | 'monthly' | 'custom';
// 求人ランキングの期間モード
type RankingPeriodMode = 'week' | 'month' | '3m' | '6m' | 'custom';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: '公開中', color: 'bg-green-100 text-green-700' },
  WORKING: { label: '稼働中', color: 'bg-blue-100 text-blue-700' },
  STOPPED: { label: '停止', color: 'bg-yellow-100 text-yellow-700' },
  COMPLETED: { label: '完了', color: 'bg-slate-100 text-slate-600' },
  DRAFT: { label: '下書き', color: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: '取消', color: 'bg-red-100 text-red-600' },
};

interface JobRankingItem {
  jobId: number;
  jobTitle: string;
  status: string;
  pv: number;
  users: number;
  applicationCount: number;
  applicationRate: number;
  avgApplicationDays: number;
}

type JobRankingSortKey = 'pv' | 'users' | 'applicationCount' | 'applicationRate' | 'avgApplicationDays';

interface BreakdownRow {
  period: string;
  totalPV: number;
  totalUsers: number;
  applicationCount: number;
  applicationUserCount: number;
  avgApplicationDays: number;
}

interface AnalyticsData {
  totalPV: number;
  totalUsers: number;
  applicationCount: number;
  applicationUserCount: number;
  avgApplicationDays: number;
  jobRanking: JobRankingItem[];
  breakdown?: BreakdownRow[];
}

// 日別表示のperiod文字列("2026-02-20")を表示用に変換
function formatDailyPeriod(period: string): string {
  const parts = period.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  return period;
}

// 月別表示のperiod文字列("2026-02")を表示用に変換
function formatMonthlyPeriod(period: string): string {
  const parts = period.split('-');
  if (parts.length === 2) {
    return `${parseInt(parts[1])}月`;
  }
  return period;
}

export default function JobAnalytics() {
  // === アクセス状況の状態 ===
  const [accessMode, setAccessMode] = useState<AccessPeriodMode>('daily');
  const [accessCurrentMonth, setAccessCurrentMonth] = useState<Date>(new Date());
  const [accessCurrentYear, setAccessCurrentYear] = useState<Date>(new Date());
  const [accessCustomStart, setAccessCustomStart] = useState('');
  const [accessCustomEnd, setAccessCustomEnd] = useState('');
  const [accessCustomBreakdown, setAccessCustomBreakdown] = useState<'daily' | 'monthly'>('daily');
  const [accessData, setAccessData] = useState<AnalyticsData | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // === 求人ランキングの状態 ===
  const [rankingMode, setRankingMode] = useState<RankingPeriodMode>('month');
  const [rankingCustomStart, setRankingCustomStart] = useState('');
  const [rankingCustomEnd, setRankingCustomEnd] = useState('');
  const [rankingData, setRankingData] = useState<AnalyticsData | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  // 求人ランキングソート
  const [rankingSortKey, setRankingSortKey] = useState<JobRankingSortKey>('pv');
  const [rankingSortDir, setRankingSortDir] = useState<'asc' | 'desc'>('desc');

  // === アクセス状況の日付範囲計算 ===
  const getAccessDateRange = useCallback((): { startDate: string; endDate: string; breakdown: 'daily' | 'monthly' } => {
    switch (accessMode) {
      case 'daily': {
        const start = getFirstDayOfMonth(accessCurrentMonth);
        const end = getLastDayOfMonth(accessCurrentMonth);
        return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'daily' };
      }
      case 'monthly': {
        const start = getFirstDayOfYear(accessCurrentYear);
        const end = getLastDayOfYear(accessCurrentYear);
        return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'monthly' };
      }
      case 'custom':
        return { startDate: accessCustomStart, endDate: accessCustomEnd, breakdown: accessCustomBreakdown };
    }
  }, [accessMode, accessCurrentMonth, accessCurrentYear, accessCustomStart, accessCustomEnd, accessCustomBreakdown]);

  // === 求人ランキングの日付範囲計算 ===
  const getRankingDateRange = useCallback((): { startDate: string; endDate: string } => {
    const now = new Date();
    switch (rankingMode) {
      case 'week': {
        const start = getMonday(now);
        const end = getSunday(start);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case 'month': {
        const start = getFirstDayOfMonth(now);
        const end = getLastDayOfMonth(now);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case '3m': {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = getLastDayOfMonth(now);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case '6m': {
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const end = getLastDayOfMonth(now);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case 'custom':
        return { startDate: rankingCustomStart, endDate: rankingCustomEnd };
    }
  }, [rankingMode, rankingCustomStart, rankingCustomEnd]);

  // === アクセス状況のデータ取得 ===
  const fetchAccessData = useCallback(async () => {
    setAccessLoading(true);
    try {
      const { startDate, endDate, breakdown } = getAccessDateRange();
      if (!startDate || !endDate) {
        setAccessLoading(false);
        return;
      }
      const params = new URLSearchParams({ startDate, endDate, breakdown });
      const res = await fetch(`/api/job-analytics?${params}`);
      const json = await res.json();
      setAccessData(json);
    } catch (error) {
      console.error('Failed to fetch access data:', error);
    } finally {
      setAccessLoading(false);
    }
  }, [getAccessDateRange]);

  // === 求人ランキングのデータ取得 ===
  const fetchRankingData = useCallback(async () => {
    setRankingLoading(true);
    try {
      const { startDate, endDate } = getRankingDateRange();
      if (!startDate || !endDate) {
        setRankingLoading(false);
        return;
      }
      const params = new URLSearchParams({ startDate, endDate });
      if (activeOnly) params.set('activeOnly', 'true');
      const res = await fetch(`/api/job-analytics?${params}`);
      const json = await res.json();
      setRankingData(json);
    } catch (error) {
      console.error('Failed to fetch ranking data:', error);
    } finally {
      setRankingLoading(false);
    }
  }, [getRankingDateRange, activeOnly]);

  // アクセス状況: モードや期間変更で自動取得
  useEffect(() => {
    fetchAccessData();
  }, [fetchAccessData]);

  // 求人ランキング: 初回 + モード変更で自動取得（カスタム以外）
  useEffect(() => {
    if (rankingMode !== 'custom') {
      fetchRankingData();
    }
  }, [rankingMode, activeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // ナビゲーション
  const navigateAccessMonth = (direction: number) => {
    const next = new Date(accessCurrentMonth);
    next.setMonth(next.getMonth() + direction);
    setAccessCurrentMonth(next);
  };

  const navigateAccessYear = (direction: number) => {
    const next = new Date(accessCurrentYear);
    next.setFullYear(next.getFullYear() + direction);
    setAccessCurrentYear(next);
  };

  // ソートされた求人ランキング
  const sortedJobRanking = useMemo(() => {
    if (!rankingData?.jobRanking) return [];
    return [...rankingData.jobRanking].sort((a, b) => {
      const aVal = a[rankingSortKey];
      const bVal = b[rankingSortKey];
      return rankingSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [rankingData?.jobRanking, rankingSortKey, rankingSortDir]);

  const handleRankingSort = (key: JobRankingSortKey) => {
    if (rankingSortKey === key) {
      setRankingSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setRankingSortKey(key);
      setRankingSortDir('desc');
    }
  };

  const SortIcon = ({ sortKey }: { sortKey: JobRankingSortKey }) => {
    if (rankingSortKey !== sortKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return rankingSortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 ml-1 text-indigo-600" />
      : <ArrowUp className="w-3 h-3 ml-1 text-indigo-600" />;
  };

  // 求人ランキングの期間ラベル
  const getRankingPeriodLabel = () => {
    const { startDate, endDate } = getRankingDateRange();
    if (!startDate || !endDate) return '';
    return `${startDate} 〜 ${endDate}`;
  };

  return (
    <div>
      {/* 説明 */}
      <p className="text-sm text-slate-500 mb-4">ログイン後ユーザーの求人閲覧・応募データ（JobDetailPageView + Application）</p>

      {/* ==================== アクセス状況 ==================== */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-slate-900">アクセス状況</h2>

            <div className="flex items-center gap-3 flex-wrap">
              {/* モード切替: 日 / 月 / カスタム */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {(['daily', 'monthly', 'custom'] as AccessPeriodMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setAccessMode(mode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      accessMode === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'daily' ? '日' : mode === 'monthly' ? '月' : 'カスタム'}
                  </button>
                ))}
              </div>

              {/* ナビゲーション: 日モード（月単位移動） */}
              {accessMode === 'daily' && (
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                  <button onClick={() => navigateAccessMonth(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[120px] text-center">
                    {formatMonthDisplay(accessCurrentMonth)}
                  </span>
                  <button onClick={() => navigateAccessMonth(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ナビゲーション: 月モード（年単位移動） */}
              {accessMode === 'monthly' && (
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                  <button onClick={() => navigateAccessYear(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[100px] text-center">
                    {formatYearDisplay(accessCurrentYear)}
                  </span>
                  <button onClick={() => navigateAccessYear(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* カスタム: 期間入力 + 日/月切替 */}
              {accessMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={accessCustomStart}
                    onChange={e => setAccessCustomStart(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-slate-400">〜</span>
                  <input
                    type="date"
                    value={accessCustomEnd}
                    onChange={e => setAccessCustomEnd(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-1">
                    <button
                      onClick={() => setAccessCustomBreakdown('daily')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        accessCustomBreakdown === 'daily'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      日
                    </button>
                    <button
                      onClick={() => setAccessCustomBreakdown('monthly')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        accessCustomBreakdown === 'monthly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      月
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ローディング */}
        {accessLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 mx-auto"></div>
            <p className="mt-2 text-sm text-slate-600">読み込み中...</p>
          </div>
        )}

        {/* アクセス状況テーブル */}
        {!accessLoading && accessData && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">期間</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">求人閲覧PV</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">閲覧ユーザー数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">応募数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">応募ユーザー数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">平均応募日数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* 合計行 */}
                <tr className="bg-indigo-50 font-semibold">
                  <td className="px-4 py-3 text-slate-900">
                    {accessMode === 'daily' ? formatMonthDisplay(accessCurrentMonth) + ' 合計'
                      : accessMode === 'monthly' ? formatYearDisplay(accessCurrentYear) + ' 合計'
                      : '合計'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">{accessData.totalPV.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{accessData.totalUsers.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{accessData.applicationCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{accessData.applicationUserCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{accessData.avgApplicationDays}日</td>
                </tr>

                {/* ブレイクダウン行（日別/月別） */}
                {accessData.breakdown?.map((row) => (
                  <tr key={row.period} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {accessMode === 'daily' || (accessMode === 'custom' && accessCustomBreakdown === 'daily')
                        ? formatDailyPeriod(row.period)
                        : formatMonthlyPeriod(row.period)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.totalPV.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.totalUsers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.applicationCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.applicationUserCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.avgApplicationDays}日</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== 求人ランキング ==================== */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-slate-900">求人ランキング</h2>

            <div className="flex items-center gap-3 flex-wrap">
              {/* 期間切替: 週 / 月 / 3M / 6M / カスタム */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {(['week', 'month', '3m', '6m', 'custom'] as RankingPeriodMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setRankingMode(mode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rankingMode === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'week' ? '週' : mode === 'month' ? '月' : mode === '3m' ? '3M' : mode === '6m' ? '6M' : 'カスタム'}
                  </button>
                ))}
              </div>

              {/* カスタム期間 + 集計ボタン */}
              {rankingMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={rankingCustomStart}
                    onChange={e => setRankingCustomStart(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-slate-400">〜</span>
                  <input
                    type="date"
                    value={rankingCustomEnd}
                    onChange={e => setRankingCustomEnd(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={fetchRankingData}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    集計
                  </button>
                </div>
              )}

              {/* 掲載中のみ表示 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={e => setActiveOnly(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600">掲載中のみ</span>
              </label>
            </div>
          </div>

          {/* 集計期間表示 */}
          <p className="text-xs text-slate-400 mt-2">{getRankingPeriodLabel()}</p>
        </div>

        {/* ローディング */}
        {rankingLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 mx-auto"></div>
            <p className="mt-2 text-sm text-slate-600">読み込み中...</p>
          </div>
        )}

        {!rankingLoading && rankingData && (
          <>
            {sortedJobRanking.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                まだデータがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">求人タイトル</th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                        onClick={() => handleRankingSort('pv')}
                      >
                        <span className="inline-flex items-center">PV<SortIcon sortKey="pv" /></span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                        onClick={() => handleRankingSort('users')}
                      >
                        <span className="inline-flex items-center">ユーザー数<SortIcon sortKey="users" /></span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                        onClick={() => handleRankingSort('applicationCount')}
                      >
                        <span className="inline-flex items-center">応募数<SortIcon sortKey="applicationCount" /></span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                        onClick={() => handleRankingSort('applicationRate')}
                      >
                        <span className="inline-flex items-center">応募率<SortIcon sortKey="applicationRate" /></span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                        onClick={() => handleRankingSort('avgApplicationDays')}
                      >
                        <span className="inline-flex items-center">平均応募日数<SortIcon sortKey="avgApplicationDays" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedJobRanking.map((job, index) => {
                      const statusInfo = STATUS_LABELS[job.status] || { label: job.status, color: 'bg-gray-100 text-gray-500' };
                      return (
                        <tr key={job.jobId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`/jobs/${job.jobId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-900 hover:text-indigo-600 hover:underline truncate max-w-[300px]"
                              >
                                {job.jobTitle}
                              </a>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">
                                #{job.jobId}
                              </span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{job.pv.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{job.users.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{job.applicationCount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{job.applicationRate}%</td>
                          <td className="px-4 py-3 text-right text-slate-600">{job.avgApplicationDays}日</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* データなし */}
      {!accessLoading && !accessData && !rankingLoading && !rankingData && (
        <div className="text-center py-12 text-slate-400">
          データの取得に失敗しました
        </div>
      )}
    </div>
  );
}
