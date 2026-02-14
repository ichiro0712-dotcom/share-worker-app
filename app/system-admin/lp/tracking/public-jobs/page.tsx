'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Clock, ChevronDown, ChevronRight, Filter } from 'lucide-react';

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

const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const formatDateDisplay = (date: Date): string => `${date.getMonth() + 1}/${date.getDate()}`;
const formatMonthDisplay = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月`;

type PeriodMode = 'week' | 'month' | 'custom';

type Genre = {
  id: number;
  prefix: string;
  name: string;
};

interface TrackingData {
  totalPV: number;
  totalSessions: number;
  jobDetailPV: number;
  ctaClicks: number;
  ctr: number;
  registrations: number;
  cvr: number;
  avgDwellTime: number;
  campaignBreakdown: Array<{
    campaignCode: string;
    pv: number;
    sessions: number;
    jobDetailPV: number;
    ctaClicks: number;
    ctr: number;
    registrations: number;
    cvr: number;
  }>;
  jobRanking: Array<{
    jobId: number;
    jobTitle: string;
    pv: number;
    sessions: number;
  }>;
}

export default function PublicJobsTrackingPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCodes, setExpandedCodes] = useState(false);

  // ジャンルフィルター
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');

  // ジャンル一覧を取得
  useEffect(() => {
    fetch('/api/lp-code-genres')
      .then(res => res.json())
      .then(data => {
        if (data.genres) setGenres(data.genres);
      })
      .catch(() => {});
  }, []);

  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    switch (periodMode) {
      case 'week': {
        const start = currentWeekStart;
        const end = getSunday(start);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case 'month': {
        const start = getFirstDayOfMonth(currentMonth);
        const end = getLastDayOfMonth(currentMonth);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      }
      case 'custom':
        return { startDate: customStart, endDate: customEnd };
    }
  }, [periodMode, currentWeekStart, currentMonth, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      if (!startDate || !endDate) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ startDate, endDate });
      if (selectedGenre) {
        params.set('genrePrefix', selectedGenre);
      }

      const res = await fetch(`/api/lp-tracking/public-jobs?${params}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedGenre]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateWeek = (direction: number) => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + direction * 7);
    setCurrentWeekStart(next);
  };

  const navigateMonth = (direction: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + direction);
    setCurrentMonth(next);
  };

  const getPeriodLabel = () => {
    switch (periodMode) {
      case 'week': {
        const end = getSunday(currentWeekStart);
        return `${formatDateDisplay(currentWeekStart)} 〜 ${formatDateDisplay(end)}`;
      }
      case 'month':
        return formatMonthDisplay(currentMonth);
      case 'custom':
        return customStart && customEnd ? `${customStart} 〜 ${customEnd}` : '期間を選択';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/system-admin/lp"
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              公開求人検索 トラッキング
            </h1>
            <p className="text-sm text-gray-500">LP0 - /public/jobs</p>
          </div>
        </div>

        {/* 期間選択 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* モード切替 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['week', 'month', 'custom'] as PeriodMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPeriodMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    periodMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode === 'week' ? '週' : mode === 'month' ? '月' : 'カスタム'}
                </button>
              ))}
            </div>

            {/* ナビゲーション */}
            {periodMode === 'week' && (
              <div className="flex items-center gap-2">
                <button onClick={() => navigateWeek(-1)} className="p-1 rounded hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-sm font-medium min-w-[140px] text-center">
                  {getPeriodLabel()}
                </span>
                <button onClick={() => navigateWeek(1)} className="p-1 rounded hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {periodMode === 'month' && (
              <div className="flex items-center gap-2">
                <button onClick={() => navigateMonth(-1)} className="p-1 rounded hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {getPeriodLabel()}
                </span>
                <button onClick={() => navigateMonth(1)} className="p-1 rounded hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="px-2 py-1 text-sm border rounded"
                />
                <span className="text-sm text-gray-500">〜</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="px-2 py-1 text-sm border rounded"
                />
              </div>
            )}

            {/* ジャンルフィルター */}
            {genres.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedGenre}
                  onChange={e => setSelectedGenre(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1"
                >
                  <option value="">全ジャンル</option>
                  {genres.map(g => (
                    <option key={g.id} value={g.prefix}>
                      {g.name} ({g.prefix})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto mb-3" />
            データを取得中...
          </div>
        )}

        {/* データ表示 */}
        {!loading && data && (
          <div className="space-y-6">
            {/* サマリーカード */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard label="PV" value={data.totalPV} icon={<BarChart3 className="w-5 h-5" />} />
              <SummaryCard label="セッション" value={data.totalSessions} icon={<BarChart3 className="w-5 h-5" />} />
              <SummaryCard label="求人閲覧数" value={data.jobDetailPV} icon={<BarChart3 className="w-5 h-5" />} />
              <SummaryCard
                label="平均滞在時間"
                value={`${Math.floor(data.avgDwellTime / 60)}:${String(data.avgDwellTime % 60).padStart(2, '0')}`}
                icon={<Clock className="w-5 h-5" />}
                isText
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard label="登録ボタンクリック" value={data.ctaClicks} color="blue" />
              <SummaryCard label="CTR" value={`${data.ctr}%`} color="blue" isText />
              <SummaryCard label="登録数" value={data.registrations} color="green" />
              <SummaryCard label="CVR" value={`${data.cvr}%`} color="green" isText />
            </div>

            {/* アクセス状況テーブル */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">アクセス状況</h2>
                  <button
                    onClick={() => setExpandedCodes(!expandedCodes)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {expandedCodes ? (
                      <><ChevronDown className="w-3.5 h-3.5" />コード別を閉じる</>
                    ) : (
                      <><ChevronRight className="w-3.5 h-3.5" />コード別を展開</>
                    )}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="px-4 py-2 text-left font-medium">ソース</th>
                      <th className="px-4 py-2 text-right font-medium">PV</th>
                      <th className="px-4 py-2 text-right font-medium">セッション</th>
                      <th className="px-4 py-2 text-right font-medium">求人閲覧</th>
                      <th className="px-4 py-2 text-right font-medium">CTAクリック</th>
                      <th className="px-4 py-2 text-right font-medium">CTR</th>
                      <th className="px-4 py-2 text-right font-medium">登録</th>
                      <th className="px-4 py-2 text-right font-medium">CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 合計行 */}
                    <tr className="border-b border-gray-200 font-semibold bg-blue-50/50">
                      <td className="px-4 py-3 text-gray-900">合計</td>
                      <td className="px-4 py-3 text-right">{data.totalPV.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.totalSessions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.jobDetailPV.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.ctaClicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.ctr}%</td>
                      <td className="px-4 py-3 text-right">{data.registrations.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.cvr}%</td>
                    </tr>

                    {/* キャンペーンコード別行 */}
                    {expandedCodes && data.campaignBreakdown.map((row) => (
                      <tr key={row.campaignCode} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">
                          {row.campaignCode === '(direct)' ? (
                            <span className="text-gray-400 italic">直接アクセス</span>
                          ) : (
                            <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                              {row.campaignCode}
                            </code>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.pv.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.sessions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.jobDetailPV.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.ctaClicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.ctr}%</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.registrations.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.cvr}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 閲覧求人ランキング */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">閲覧求人ランキング</h2>
              </div>

              {data.jobRanking.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  まだ閲覧データがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="px-4 py-2 text-left font-medium w-10">#</th>
                        <th className="px-4 py-2 text-left font-medium">求人タイトル</th>
                        <th className="px-4 py-2 text-right font-medium">PV</th>
                        <th className="px-4 py-2 text-right font-medium">セッション</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.jobRanking.map((job, index) => (
                        <tr key={job.jobId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 font-mono text-xs">{index + 1}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 truncate max-w-[400px]">
                                {job.jobTitle}
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                #{job.jobId}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">{job.pv.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{job.sessions.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* データなし */}
        {!loading && !data && (
          <div className="text-center py-12 text-gray-400">
            データの取得に失敗しました
          </div>
        )}
      </div>
    </div>
  );
}

// サマリーカードコンポーネント
function SummaryCard({
  label,
  value,
  icon,
  color = 'gray',
  isText = false,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'gray' | 'blue' | 'green';
  isText?: boolean;
}) {
  const colorClasses = {
    gray: 'bg-white',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
  };

  const valueColor = {
    gray: 'text-gray-900',
    blue: 'text-blue-700',
    green: 'text-green-700',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg border border-gray-200 p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueColor[color]}`}>
        {isText ? value : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </div>
  );
}
