'use client';

import { useState, useEffect } from 'react';
import { getWorkerAnalyticsData, WorkerMetrics, AnalyticsFilter } from '@/src/lib/analytics-actions';
import AnalyticsFilters from '@/components/system-admin/analytics/AnalyticsFilters';

const METRIC_LABELS: Record<keyof Omit<WorkerMetrics, 'date'>, string> = {
    registeredCount: '登録ワーカー数',
    newCount: '入会ワーカー数',
    withdrawnCount: '退会ワーカー数',
    reviewCount: 'レビュー数',
    reviewAvg: 'レビュー平均点',
    cancelRate: 'キャンセル率(%)',
    lastMinuteCancelRate: '直前キャンセル率(%)',
    dropoutRate: '登録離脱率(%)',
    withdrawalRate: '退会率(%)'
};

export default function WorkerAnalytics() {
    const [data, setData] = useState<WorkerMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [currentFilters, setCurrentFilters] = useState<any>({});

    const fetchData = async (filterValues?: any) => {
        setLoading(true);
        const filtersToUse = filterValues || currentFilters;
        if (filterValues) {
            setCurrentFilters(filterValues);
        }
        try {
            const filter: AnalyticsFilter = {
                viewMode: viewMode,
                startDate: filtersToUse?.startDate ? new Date(filtersToUse.startDate) : undefined,
                endDate: filtersToUse?.endDate ? new Date(filtersToUse.endDate) : undefined,
                // 配列フィルター
                ageRanges: filtersToUse?.ageRanges || undefined,
                qualifications: filtersToUse?.qualifications || undefined,
                genders: filtersToUse?.genders || undefined,
                regionId: filtersToUse?.regionId ? parseInt(filtersToUse.regionId) : undefined
            };
            const result = await getWorkerAnalyticsData(filter);
            setData(result);
        } catch (error) {
            console.error('Failed to fetch worker analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [viewMode]);

    const handleViewModeChange = (mode: 'daily' | 'monthly') => {
        setViewMode(mode);
    };

    return (
        <div>
            <AnalyticsFilters
                showWorkerFilters={true}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onFilter={fetchData}
            />

            {/* データ表示エリア */}
            <div className="bg-white rounded-lg border border-slate-200">
                {/* トグルスイッチ（左上） */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-4">
                    <span className="text-sm text-slate-600">表示形式:</span>
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => handleViewModeChange('daily')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                                viewMode === 'daily'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            日次
                        </button>
                        <button
                            onClick={() => handleViewModeChange('monthly')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                                viewMode === 'monthly'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            月次
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                                        {viewMode === 'daily' ? '日付' : '月'}
                                    </th>
                                    {Object.entries(METRIC_LABELS).map(([key, label]) => (
                                        <th key={key} className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data.length === 0 ? (
                                    <tr>
                                        <td colSpan={Object.keys(METRIC_LABELS).length + 1} className="px-4 py-8 text-center text-slate-500">
                                            データがありません
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-900 sticky left-0 bg-white">
                                                {row.date}
                                            </td>
                                            {Object.keys(METRIC_LABELS).map(key => (
                                                <td key={key} className="px-4 py-3 text-sm text-slate-700 text-right">
                                                    {row[key as keyof WorkerMetrics]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
