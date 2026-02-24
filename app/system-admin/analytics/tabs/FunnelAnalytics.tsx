'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Search, AlertTriangle, Info } from 'lucide-react';

// 日付ユーティリティ
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
const getFirstDayOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1);
const getLastDayOfYear = (date: Date): Date => new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const formatMonthDisplay = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月`;
const formatYearDisplay = (date: Date): string => `${date.getFullYear()}年`;

type PeriodMode = 'daily' | 'monthly' | 'custom';

interface FunnelData {
  registered: number;
  verified: number;
  searchReached: number;
  jobViewed: number;
  jobViewedPV: number;
  bookmarked: number;
  applied: number;
  applicationTotal: number;
}

interface BySourceItem {
  source: string;
  sourceLabel: string;
  registered: number;
  verified: number;
  searchReached: number;
  jobViewed: number;
  bookmarked: number;
  applied: number;
  conversionRate: number;
}

interface BreakdownRow {
  period: string;
  registered: number;
  verified: number;
  searchReached: number;
  jobViewed: number;
  bookmarked: number;
  applied: number;
}

interface ApiResponse {
  funnel: FunnelData;
  overallConversionRate: number;
  avgRegistrationToVerifyHours: number | null;
  bySource?: BySourceItem[];
  breakdown?: BreakdownRow[];
}

const FUNNEL_STEPS = [
  { key: 'registered', label: '①登録完了', description: '新規登録を完了したユーザー数' },
  { key: 'verified', label: '②メール認証', description: 'メールアドレス認証を完了したユーザー数' },
  { key: 'searchReached', label: '③求人検索到達', description: '求人検索ページ（トップページ）に到達したユーザー数' },
  { key: 'jobViewed', label: '④求人詳細閲覧', description: '求人詳細ページを1件以上閲覧したユーザー数' },
  { key: 'bookmarked', label: '⑤お気に入り登録', description: '求人をお気に入りに登録したユーザー数' },
  { key: 'applied', label: '⑥応募完了', description: '求人に応募を完了したユーザー数' },
] as const;

// データ収集開始日
const DATA_TRACKING_START = {
  registered: '2025年4月〜（サービス開始時点から）',
  verified: '2025年4月〜（サービス開始時点から）',
  searchReached: '本機能デプロイ後から記録開始',
  jobViewed: '2026年2月〜（JobDetailPageViewテーブル作成後）',
  bookmarked: '2025年4月〜（サービス開始時点から）',
  applied: '2025年4月〜（サービス開始時点から）',
  emailVerifiedAt: '本機能デプロイ後から記録開始（既存ユーザーはタイムスタンプなし）',
};

// 日別period文字列を表示用に変換
function formatDailyPeriod(period: string): string {
  const parts = period.split('-');
  if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return period;
}

function formatMonthlyPeriod(period: string): string {
  const parts = period.split('-');
  if (parts.length === 2) return `${parseInt(parts[1])}月`;
  return period;
}

// ソース選択肢
const SOURCE_OPTIONS = [
  { value: 'all', label: '全体' },
  { value: 'direct', label: '直接流入' },
  { value: '0', label: '公開求人検索' },
];

export default function FunnelAnalytics() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentYear, setCurrentYear] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customBreakdown, setCustomBreakdown] = useState<'daily' | 'monthly'>('daily');
  const [source, setSource] = useState('all');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lpOptions, setLpOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [showDataNotes, setShowDataNotes] = useState(false);

  // LP一覧を取得してソース選択肢に追加
  useEffect(() => {
    fetch('/api/lp-tracking?startDate=2020-01-01&endDate=2030-12-31')
      .then(res => res.json())
      .then(json => {
        if (json.registrations) {
          const lpIds = new Set<string>();
          json.registrations.forEach((r: { lpId: string }) => {
            if (r.lpId && r.lpId !== '0') lpIds.add(r.lpId);
          });
          setLpOptions(
            Array.from(lpIds).sort().map(id => ({ value: id, label: `LP${id}` }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const getDateRange = useCallback((): { startDate: string; endDate: string; breakdown: 'daily' | 'monthly' } => {
    switch (periodMode) {
      case 'daily': {
        const start = getFirstDayOfMonth(currentMonth);
        const end = getLastDayOfMonth(currentMonth);
        return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'daily' };
      }
      case 'monthly': {
        const start = getFirstDayOfYear(currentYear);
        const end = getLastDayOfYear(currentYear);
        return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'monthly' };
      }
      case 'custom':
        return { startDate: customStart, endDate: customEnd, breakdown: customBreakdown };
    }
  }, [periodMode, currentMonth, currentYear, customStart, customEnd, customBreakdown]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate, breakdown } = getDateRange();
      if (!startDate || !endDate) {
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({ startDate, endDate, breakdown, source });
      const res = await fetch(`/api/funnel-analytics?${params}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch funnel data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateMonth = (direction: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + direction);
    setCurrentMonth(next);
  };

  const navigateYear = (direction: number) => {
    const next = new Date(currentYear);
    next.setFullYear(next.getFullYear() + direction);
    setCurrentYear(next);
  };

  // ファネルバーの幅を計算
  const getBarWidth = (value: number, max: number): number => {
    if (max === 0) return 0;
    return Math.max(4, (value / max) * 100);
  };

  // 転換率を計算
  const getConversionRate = (current: number, previous: number): string => {
    if (previous === 0) return '-';
    return `${Math.round((current / previous) * 1000) / 10}%`;
  };

  // 離脱率を計算
  const getDropoffRate = (current: number, previous: number): string => {
    if (previous === 0) return '-';
    return `${Math.round(((previous - current) / previous) * 1000) / 10}%`;
  };

  return (
    <div>
      {/* 説明 + データ記録開始日の注意 */}
      <div className="mb-4">
        <p className="text-sm text-slate-500">新規登録から応募完了までのユーザージャーニーを分析します</p>
        <button
          onClick={() => setShowDataNotes(!showDataNotes)}
          className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
        >
          <Info className="w-3.5 h-3.5" />
          データ記録開始日について
        </button>
        {showDataNotes && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">各指標のデータ記録開始日</p>
                <ul className="space-y-0.5">
                  <li>・<strong>①登録完了 / ②メール認証 / ⑤お気に入り / ⑥応募完了</strong>: {DATA_TRACKING_START.registered}</li>
                  <li>・<strong>③求人検索到達</strong>: {DATA_TRACKING_START.searchReached}</li>
                  <li>・<strong>④求人詳細閲覧</strong>: {DATA_TRACKING_START.jobViewed}</li>
                  <li>・<strong>認証所要時間（email_verified_at）</strong>: {DATA_TRACKING_START.emailVerifiedAt}</li>
                </ul>
                <p className="mt-1 text-amber-600">※ 記録開始前のデータは0と表示されます。データは時間経過とともに蓄積されます。</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 期間選択 + ソースフィルター */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* モード切替 */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {(['daily', 'monthly', 'custom'] as PeriodMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPeriodMode(mode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      periodMode === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'daily' ? '日' : mode === 'monthly' ? '月' : 'カスタム'}
                  </button>
                ))}
              </div>

              {/* ナビゲーション: 日モード */}
              {periodMode === 'daily' && (
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                  <button onClick={() => navigateMonth(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[120px] text-center">
                    {formatMonthDisplay(currentMonth)}
                  </span>
                  <button onClick={() => navigateMonth(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ナビゲーション: 月モード */}
              {periodMode === 'monthly' && (
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                  <button onClick={() => navigateYear(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[100px] text-center">
                    {formatYearDisplay(currentYear)}
                  </span>
                  <button onClick={() => navigateYear(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* カスタム */}
              {periodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <span className="text-slate-400">〜</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-1">
                    <button onClick={() => setCustomBreakdown('daily')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${customBreakdown === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>日</button>
                    <button onClick={() => setCustomBreakdown('monthly')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${customBreakdown === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>月</button>
                  </div>
                </div>
              )}
            </div>

            {/* ソースフィルター */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">流入元:</span>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {lpOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-2 text-sm text-slate-600">読み込み中...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ==================== ファネル概要 ==================== */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">ファネル概要</h2>
                {data.avgRegistrationToVerifyHours !== null && (
                  <span className="text-xs text-slate-500">
                    登録→認証 平均: <strong>{data.avgRegistrationToVerifyHours}時間</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* ファネルバー */}
              <div className="space-y-3 mb-6">
                {FUNNEL_STEPS.map((step, i) => {
                  const value = data.funnel[step.key as keyof FunnelData] as number;
                  const maxValue = data.funnel.registered;
                  const prevValue = i === 0
                    ? value
                    : data.funnel[FUNNEL_STEPS[i - 1].key as keyof FunnelData] as number;

                  return (
                    <div key={step.key} className="flex items-center gap-4">
                      <div className="w-32 flex-shrink-0 text-right">
                        <span className="text-sm font-medium text-slate-700">{step.label}</span>
                      </div>
                      <div className="flex-1 relative">
                        <div
                          className="h-8 bg-indigo-500 rounded-r-md flex items-center justify-end pr-3 transition-all duration-500"
                          style={{
                            width: `${getBarWidth(value, maxValue)}%`,
                            opacity: 1 - (i * 0.12),
                          }}
                        >
                          <span className="text-xs font-bold text-white">{value.toLocaleString()}人</span>
                        </div>
                      </div>
                      <div className="w-20 flex-shrink-0 text-right">
                        <span className="text-xs text-slate-500">
                          {i === 0 ? '-' : getConversionRate(value, prevValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* サマリーテーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-2 text-left text-xs font-medium">ステップ</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">ユーザー数</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">転換率</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">離脱率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {FUNNEL_STEPS.map((step, i) => {
                      const value = data.funnel[step.key as keyof FunnelData] as number;
                      const prevValue = i === 0 ? value : data.funnel[FUNNEL_STEPS[i - 1].key as keyof FunnelData] as number;
                      return (
                        <tr key={step.key} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-slate-700">{step.label}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{step.description}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{value.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{i === 0 ? '-' : getConversionRate(value, prevValue)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{i === 0 ? '-' : getDropoffRate(value, prevValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50 font-semibold">
                      <td className="px-4 py-2.5 text-slate-900">全体転換率（登録→応募）</td>
                      <td className="px-4 py-2.5 text-right text-indigo-600">{data.overallConversionRate}%</td>
                      <td colSpan={2} className="px-4 py-2.5 text-right text-xs text-slate-500">
                        応募{data.funnel.applied}人 / 登録{data.funnel.registered}人
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* ==================== 日別/月別ブレイクダウン ==================== */}
          {data.breakdown && data.breakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {periodMode === 'daily' || (periodMode === 'custom' && customBreakdown === 'daily') ? '日別' : '月別'}ブレイクダウン
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 text-left text-xs font-medium">期間</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">登録</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">認証</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">検索到達</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">詳細閲覧</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">お気に入り</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">応募</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* 合計行 */}
                    <tr className="bg-indigo-50 font-semibold">
                      <td className="px-4 py-3 text-slate-900">合計</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.registered}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.verified}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.searchReached}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.jobViewed}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.bookmarked}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{data.funnel.applied}</td>
                    </tr>
                    {data.breakdown.map(row => (
                      <tr key={row.period} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700 font-medium">
                          {periodMode === 'daily' || (periodMode === 'custom' && customBreakdown === 'daily')
                            ? formatDailyPeriod(row.period)
                            : formatMonthlyPeriod(row.period)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.registered}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.verified}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.searchReached}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.jobViewed}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.bookmarked}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.applied}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 流入元別比較 ==================== */}
          {data.bySource && data.bySource.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">流入元別比較</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 text-left text-xs font-medium">流入元</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">登録</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">認証</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">検索到達</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">詳細閲覧</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">お気に入り</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">応募</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">転換率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.bySource.map(row => (
                      <tr key={row.source} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{row.sourceLabel}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.registered}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.verified}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.searchReached}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.jobViewed}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.bookmarked}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.applied}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-indigo-600">{row.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* データなし */}
      {!loading && !data && (
        <div className="text-center py-12 text-slate-400">
          データの取得に失敗しました
        </div>
      )}
    </div>
  );
}
