'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft, Filter, AlertTriangle, Info, Check } from 'lucide-react';

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
  registrationPagePV: number;
  registrationPageUU: number;
  registered: number;
  verified: number;
  searchPV: number;
  searchReached: number;
  jobViewedPV: number;
  jobViewed: number;
  bookmarked: number;
  applicationClickUU: number;
  applied: number;
  applicationTotal: number;
}

interface BySourceItem {
  source: string;
  sourceLabel: string;
  registered: number;
  verified: number;
  searchPV: number;
  searchReached: number;
  jobViewedPV: number;
  jobViewed: number;
  bookmarked: number;
  applicationClickUU: number;
  applied: number;
  conversionRate: number;
}

interface BreakdownRow {
  period: string;
  registrationPagePV: number;
  registrationPageUU: number;
  registered: number;
  verified: number;
  searchPV: number;
  searchReached: number;
  jobViewedPV: number;
  jobViewed: number;
  bookmarked: number;
  applicationClickUU: number;
  applied: number;
}

interface ApiResponse {
  funnel: FunnelData;
  overallConversionRate: number;
  avgRegistrationToVerifyHours: number | null;
  hasSourceFilter: boolean;
  bySource?: BySourceItem[];
  breakdown?: BreakdownRow[];
}

const FUNNEL_STEPS = [
  { key: 'registrationPagePV', label: '新規登録ページPV', description: '新規登録ページの閲覧数', type: 'pv' as const },
  { key: 'registrationPageUU', label: '新規登録ページUU', description: '新規登録ページのユニーク訪問者数', type: 'uu' as const },
  { key: 'registered', label: '①登録完了', description: '新規登録を完了したユーザー数', type: 'uu' as const },
  { key: 'verified', label: '②メール認証', description: 'メールアドレス認証を完了したユーザー数', type: 'uu' as const },
  { key: 'searchPV', label: '求人検索PV', description: '求人検索ページの閲覧数', type: 'pv' as const },
  { key: 'searchReached', label: '③求人検索到達UU', description: '求人検索ページに到達したユーザー数', type: 'uu' as const },
  { key: 'jobViewedPV', label: '求人詳細PV', description: '求人詳細ページの閲覧数', type: 'pv' as const },
  { key: 'jobViewed', label: '④求人詳細閲覧UU', description: '求人詳細を閲覧したユーザー数', type: 'uu' as const },
  { key: 'bookmarked', label: '⑤お気に入り登録', description: '求人をお気に入りに登録したユーザー数', type: 'uu' as const },
  { key: 'applicationClickUU', label: '⑥応募ボタンクリックUU', description: '応募ボタンをクリックしたユーザー数', type: 'uu' as const },
  { key: 'applied', label: '⑦応募完了UU', description: '応募を完了したユーザー数', type: 'uu' as const },
] as const;

// UUステップのみ抽出（転換率計算用）
const UU_STEPS = FUNNEL_STEPS.filter(s => s.type === 'uu');

// データ収集開始日
const DATA_TRACKING_START = {
  registrationPage: '本機能デプロイ後から記録開始',
  registered: '2025年4月〜（サービス開始時点から）',
  verified: '2025年4月〜（サービス開始時点から）',
  searchReached: '本機能デプロイ後から記録開始',
  jobViewed: '2026年2月〜（JobDetailPageViewテーブル作成後）',
  bookmarked: '2025年4月〜（サービス開始時点から）',
  applicationClick: '本機能デプロイ後から記録開始',
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

// 固定の流入元選択肢
const FIXED_SOURCE_OPTIONS = [
  { value: 'direct', label: '直接流入' },
];

export default function FunnelAnalytics() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentYear, setCurrentYear] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customBreakdown, setCustomBreakdown] = useState<'daily' | 'monthly'>('daily');
  const [selectedSources, setSelectedSources] = useState<string[]>([]); // 空=全選択
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lpOptions, setLpOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showDataNotes, setShowDataNotes] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

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
      const sourceParam = selectedSources.length === 0 ? 'all' : selectedSources.join(',');
      const params = new URLSearchParams({ startDate, endDate, breakdown, source: sourceParam });
      const res = await fetch(`/api/funnel-analytics?${params}`);
      const json = await res.json();
      setData(json);
      // LP一覧をレスポンスから取得
      if (json.lpSources && json.lpSources.length > 0) {
        setLpOptions(json.lpSources);
      }
    } catch (error) {
      console.error('Failed to fetch funnel data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedSources]);

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

  // 登録動線バーの幅を計算
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
                  <li>・<strong>①登録完了 / ②メール認証 / ⑤お気に入り / ⑦応募完了</strong>: {DATA_TRACKING_START.registered}</li>
                  <li>・<strong>新規登録ページPV/UU</strong>: {DATA_TRACKING_START.registrationPage}</li>
                  <li>・<strong>③求人検索到達 / 求人検索PV</strong>: {DATA_TRACKING_START.searchReached}</li>
                  <li>・<strong>④求人詳細閲覧 / 求人詳細PV</strong>: {DATA_TRACKING_START.jobViewed}</li>
                  <li>・<strong>⑥応募ボタンクリックUU</strong>: {DATA_TRACKING_START.applicationClick}</li>
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

            {/* ソースフィルター（複数選択） */}
            <div>
              <button
                onClick={() => setShowFilterDropdown(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedSources.length > 0
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                絞り込み
                {selectedSources.length > 0 && (
                  <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {selectedSources.length}
                  </span>
                )}
              </button>
            </div>

            {/* フィルターモーダル */}
            {showFilterDropdown && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                <div className="fixed inset-0 bg-black/30" onClick={() => setShowFilterDropdown(false)} />
                <div ref={filterRef} className="relative bg-white rounded-xl shadow-2xl w-80 max-h-[70vh] flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">流入元で絞り込み</h3>
                      <button
                        onClick={() => setShowFilterDropdown(false)}
                        className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">未選択の場合は全体が表示されます</p>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2">
                    {[...FIXED_SOURCE_OPTIONS, ...lpOptions].map(opt => {
                      const isSelected = selectedSources.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            setSelectedSources(prev =>
                              isSelected
                                ? prev.filter(s => s !== opt.value)
                                : [...prev, opt.value]
                            );
                          }}
                        >
                          <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                      );
                    })}
                    {lpOptions.length === 0 && (
                      <div className="px-5 py-3 text-xs text-slate-400">LP情報を読み込み中...</div>
                    )}
                  </div>
                  <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                    {selectedSources.length > 0 ? (
                      <button
                        onClick={() => setSelectedSources([])}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        全解除
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{[...FIXED_SOURCE_OPTIONS, ...lpOptions].length}件の流入元</span>
                    )}
                    <button
                      onClick={() => setShowFilterDropdown(false)}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          {/* ==================== 登録動線概要 ==================== */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">登録動線概要</h2>
                {data.avgRegistrationToVerifyHours !== null && (
                  <span className="text-xs text-slate-500">
                    登録→認証 平均: <strong>{data.avgRegistrationToVerifyHours}時間</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* 登録動線バー */}
              <div className="space-y-3 mb-6">
                {FUNNEL_STEPS.map((step, i) => {
                  const value = (data.funnel[step.key as keyof FunnelData] as number) ?? 0;
                  const isPV = step.type === 'pv';
                  // ソースフィルター時、登録ページPV/UUは帰属不可のため「-」表示
                  const isRegPageWithFilter = data.hasSourceFilter && (step.key === 'registrationPagePV' || step.key === 'registrationPageUU');
                  // PVバーの最大値は最大PV、UUバーの最大値は最初のUU（registrationPageUU）
                  const maxUU = data.funnel.registrationPageUU || data.funnel.registered || 1;
                  const maxPV = Math.max(data.funnel.registrationPagePV, data.funnel.searchPV, data.funnel.jobViewedPV, 1);
                  const maxValue = isPV ? maxPV : maxUU;
                  // 転換率: UU→UU間のみ（PV行ではスキップ）
                  // ソースフィルター時、registeredの前ステップ（registrationPageUU）はフィルター非対応のため転換率を出さない
                  let conversionDisplay = '-';
                  if (!isPV && !isRegPageWithFilter) {
                    const uuIndex = UU_STEPS.findIndex(s => s.key === step.key);
                    if (uuIndex > 0) {
                      const prevStep = UU_STEPS[uuIndex - 1];
                      // ソースフィルター時、前ステップがregistrationPageUUなら転換率を出さない（データソース不整合）
                      const prevIsRegPageUU = prevStep.key === 'registrationPageUU';
                      if (!(data.hasSourceFilter && prevIsRegPageUU)) {
                        const prevUUValue = data.funnel[prevStep.key as keyof FunnelData] as number;
                        conversionDisplay = getConversionRate(value, prevUUValue);
                      }
                    }
                  }

                  const displayValue = isRegPageWithFilter ? '-' : value.toLocaleString();
                  const barWidth = isRegPageWithFilter ? 0 : getBarWidth(value, maxValue);
                  const uuIndex = isPV ? -1 : UU_STEPS.findIndex(s => s.key === step.key);

                  return (
                    <div key={step.key} className="flex items-center gap-4">
                      <div className="w-40 flex-shrink-0 text-right">
                        <span className={`text-sm font-medium ${isPV ? 'text-slate-400' : 'text-slate-700'}`}>{step.label}</span>
                      </div>
                      <div className="flex-1 relative">
                        <div
                          className={`h-8 rounded-r-md flex items-center justify-end pr-3 transition-all duration-500 ${
                            isPV ? 'bg-slate-300' : 'bg-indigo-500'
                          }`}
                          style={{
                            width: `${barWidth}%`,
                            opacity: isPV ? 0.6 : Math.max(0.4, 1 - (uuIndex * 0.08)),
                          }}
                        >
                          {!isRegPageWithFilter && (
                            <span className="text-xs font-bold text-white">{displayValue}</span>
                          )}
                        </div>
                        {isRegPageWithFilter && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">-（ソースフィルター時は非対応）</span>
                        )}
                      </div>
                      <div className="w-20 flex-shrink-0 text-right">
                        <span className="text-xs text-slate-500">{conversionDisplay}</span>
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
                      <th className="px-4 py-2 text-right text-xs font-medium">数値</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">種別</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">転換率</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">離脱率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {FUNNEL_STEPS.map((step) => {
                      const value = (data.funnel[step.key as keyof FunnelData] as number) ?? 0;
                      const isPV = step.type === 'pv';
                      const isRegPageWithFilter = data.hasSourceFilter && (step.key === 'registrationPagePV' || step.key === 'registrationPageUU');
                      const displayValue = isRegPageWithFilter ? '-' : value.toLocaleString();

                      // 転換率・離脱率はUU→UU間のみ
                      // ソースフィルター時、前ステップがregistrationPageUUなら転換率を出さない
                      let convRate = '-';
                      let dropRate = '-';
                      if (!isPV && !isRegPageWithFilter) {
                        const uuIndex = UU_STEPS.findIndex(s => s.key === step.key);
                        if (uuIndex > 0) {
                          const prevStep = UU_STEPS[uuIndex - 1];
                          const prevIsRegPageUU = prevStep.key === 'registrationPageUU';
                          if (!(data.hasSourceFilter && prevIsRegPageUU)) {
                            const prevUUValue = data.funnel[prevStep.key as keyof FunnelData] as number;
                            convRate = getConversionRate(value, prevUUValue);
                            dropRate = getDropoffRate(value, prevUUValue);
                          }
                        }
                      }

                      return (
                        <tr key={step.key} className={`hover:bg-slate-50 ${isPV ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-2.5">
                            <span className={`font-medium ${isPV ? 'text-slate-500' : 'text-slate-700'}`}>{step.label}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{step.description}</span>
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${isPV ? 'text-slate-600' : 'text-slate-900'}`}>{displayValue}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPV ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                              {isPV ? 'PV' : 'UU'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{convRate}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{dropRate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50 font-semibold">
                      <td className="px-4 py-2.5 text-slate-900">全体転換率（登録→応募）</td>
                      <td className="px-4 py-2.5 text-right text-indigo-600">{data.overallConversionRate}%</td>
                      <td colSpan={3} className="px-4 py-2.5 text-right text-xs text-slate-500">
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
                      <th className="px-3 py-3 text-left text-xs font-medium sticky left-0 bg-slate-50 z-10">期間</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">登録PV</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">登録UU</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">登録完了</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">認証</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">検索PV</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">検索UU</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">詳細PV</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">詳細UU</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">お気に入り</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">応募クリック</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">応募完了</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* 合計行 */}
                    <tr className="bg-indigo-50 font-semibold">
                      <td className="px-3 py-3 text-slate-900 sticky left-0 bg-indigo-50 z-10">合計</td>
                      <td className="px-3 py-3 text-right text-slate-500">{data.hasSourceFilter ? '-' : data.funnel.registrationPagePV}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{data.hasSourceFilter ? '-' : data.funnel.registrationPageUU}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.registered}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.verified}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{data.funnel.searchPV}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.searchReached}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{data.funnel.jobViewedPV}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.jobViewed}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.bookmarked}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.applicationClickUU}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{data.funnel.applied}</td>
                    </tr>
                    {data.breakdown.map(row => (
                      <tr key={row.period} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-700 font-medium sticky left-0 bg-white z-10">
                          {periodMode === 'daily' || (periodMode === 'custom' && customBreakdown === 'daily')
                            ? formatDailyPeriod(row.period)
                            : formatMonthlyPeriod(row.period)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{data.hasSourceFilter ? '-' : row.registrationPagePV}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{data.hasSourceFilter ? '-' : row.registrationPageUU}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.registered}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.verified}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{row.searchPV}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.searchReached}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{row.jobViewedPV}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.jobViewed}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.bookmarked}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.applicationClickUU}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.applied}</td>
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
                      <th className="px-3 py-3 text-left text-xs font-medium sticky left-0 bg-slate-50 z-10">流入元</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">登録</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">認証</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">検索PV</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">検索UU</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">詳細PV</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">詳細UU</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">お気に入り</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">応募クリック</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">応募完了</th>
                      <th className="px-3 py-3 text-right text-xs font-medium">転換率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.bySource.map(row => (
                      <tr key={row.source} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-700 sticky left-0 bg-white z-10">{row.sourceLabel}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.registered}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.verified}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{row.searchPV}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.searchReached}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{row.jobViewedPV}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.jobViewed}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.bookmarked}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.applicationClickUU}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.applied}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-indigo-600">{row.conversionRate}%</td>
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
