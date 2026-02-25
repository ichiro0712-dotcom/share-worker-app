'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import type {
  GA4OverviewData,
  GA4TrafficData,
  GA4PagesData,
  GA4LpPerformanceData,
} from '@/src/lib/ga-client';

// 日付ユーティリティ
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const formatMonthDisplay = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月`;

type PeriodMode = 'monthly' | 'custom';
type ReportSection = 'overview' | 'traffic' | 'pages' | 'lp';

export default function GA4Analytics() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeSection, setActiveSection] = useState<ReportSection>('overview');

  // データ
  const [overviewData, setOverviewData] = useState<GA4OverviewData | null>(null);
  const [trafficData, setTrafficData] = useState<GA4TrafficData | null>(null);
  const [pagesData, setPagesData] = useState<GA4PagesData | null>(null);
  const [lpData, setLpData] = useState<GA4LpPerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = useCallback(() => {
    if (periodMode === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }, [periodMode, currentMonth, customStart, customEnd]);

  const fetchReport = useCallback(async (reportType: string) => {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate) return null;
    const res = await fetch(
      `/api/ga-analytics?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `GA4 API error: ${res.status}`);
    }
    return res.json();
  }, [getDateRange]);

  const loadData = useCallback(async () => {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, tr, pg, lp] = await Promise.all([
        fetchReport('overview'),
        fetchReport('traffic'),
        fetchReport('pages'),
        fetchReport('lp-performance'),
      ]);
      setOverviewData(ov);
      setTrafficData(tr);
      setPagesData(pg);
      setLpData(lp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [getDateRange, fetchReport]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const sections: { id: ReportSection; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'traffic', label: '流入元' },
    { id: 'pages', label: 'ページ別' },
    { id: 'lp', label: 'LP分析' },
  ];

  return (
    <div className="space-y-6">
      {/* 期間選択 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['monthly', 'custom'] as PeriodMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  periodMode === mode
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'monthly' ? '月次' : 'カスタム'}
              </button>
            ))}
          </div>

          {periodMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {formatMonthDisplay(currentMonth)}
              </span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded">
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
                className="text-sm border border-slate-300 rounded px-2 py-1"
              />
              <span className="text-slate-400">〜</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-sm border border-slate-300 rounded px-2 py-1"
              />
              <button
                onClick={loadData}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                取得
              </button>
            </div>
          )}

          {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* セクション切替 */}
      <div className="flex gap-2">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeSection === s.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {!loading && !error && (
        <>
          {activeSection === 'overview' && overviewData && <OverviewSection data={overviewData} />}
          {activeSection === 'traffic' && trafficData && <TrafficSection data={trafficData} />}
          {activeSection === 'pages' && pagesData && <PagesSection data={pagesData} />}
          {activeSection === 'lp' && lpData && <LpSection data={lpData} />}
        </>
      )}
    </div>
  );
}

// ===== 概要セクション =====
function OverviewSection({ data }: { data: GA4OverviewData }) {
  const { totals, daily } = data;
  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="PV" value={totals.pageViews.toLocaleString()} />
        <SummaryCard label="ユーザー数" value={totals.totalUsers.toLocaleString()} />
        <SummaryCard label="セッション" value={totals.sessions.toLocaleString()} />
        <SummaryCard label="直帰率" value={`${(totals.bounceRate * 100).toFixed(1)}%`} />
        <SummaryCard label="平均滞在" value={formatDuration(totals.avgSessionDuration)} />
      </div>

      {/* 日別テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">日別推移</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-600">日付</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">PV</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">ユーザー</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">セッション</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">直帰率</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">平均滞在</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row, i) => (
                <tr key={row.date} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-2 text-slate-700">{row.date}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.pageViews.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.totalUsers.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.sessions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{(row.bounceRate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono">{formatDuration(row.avgSessionDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== 流入元セクション =====
function TrafficSection({ data }: { data: GA4TrafficData }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">流入元 × メディア別</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-2 font-medium text-slate-600">ソース</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">メディア</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">セッション</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">ユーザー</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">PV</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">直帰率</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((row, i) => (
              <tr key={`${row.source}-${row.medium}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-4 py-2 text-slate-700">{row.source}</td>
                <td className="px-4 py-2 text-slate-500">{row.medium}</td>
                <td className="px-4 py-2 text-right font-mono">{row.sessions.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{row.totalUsers.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{row.pageViews.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{(row.bounceRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {data.sources.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">データがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== ページ別セクション =====
function PagesSection({ data }: { data: GA4PagesData }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">ページ別PVランキング（上位100）</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-2 font-medium text-slate-600 w-8">#</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">ページパス</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">タイトル</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">PV</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">ユーザー</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">平均滞在</th>
            </tr>
          </thead>
          <tbody>
            {data.pages.map((row, i) => (
              <tr key={row.pagePath} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                <td className="px-4 py-2 text-slate-700 max-w-[300px] truncate" title={row.pagePath}>
                  {row.pagePath}
                </td>
                <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate" title={row.pageTitle}>
                  {row.pageTitle}
                </td>
                <td className="px-4 py-2 text-right font-mono">{row.pageViews.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{row.totalUsers.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{formatDuration(row.avgSessionDuration)}</td>
              </tr>
            ))}
            {data.pages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">データがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== LP分析セクション =====
function LpSection({ data }: { data: GA4LpPerformanceData }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">LP配下（/lp/）パフォーマンス</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-2 font-medium text-slate-600">ページパス</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">PV</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">ユーザー</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">セッション</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">直帰率</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">平均滞在</th>
            </tr>
          </thead>
          <tbody>
            {data.lpPages.map((row, i) => (
              <tr key={row.pagePath} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-4 py-2 text-slate-700">{row.pagePath}</td>
                <td className="px-4 py-2 text-right font-mono">{row.pageViews.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{row.totalUsers.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{row.sessions.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{(row.bounceRate * 100).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right font-mono">{formatDuration(row.avgSessionDuration)}</td>
              </tr>
            ))}
            {data.lpPages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">LP配下のデータがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== 共通コンポーネント =====
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}分${s}秒`;
}
