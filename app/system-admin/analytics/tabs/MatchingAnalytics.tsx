'use client';

import { useState, useEffect } from 'react';
import { getMatchingAnalyticsData, MatchingMetrics, AnalyticsFilter } from '@/src/lib/analytics-actions';
import AnalyticsFilters from '@/components/system-admin/analytics/AnalyticsFilters';
import { getMatchingPeriodStats } from '@/src/lib/system-actions';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

const ALL_METRIC_LABELS: Record<string, { label: string; category: 'common' | 'worker' | 'facility' }> = {
    parentJobCount: { label: '親求人数', category: 'facility' },
    childJobCount: { label: '子求人数', category: 'facility' },
    totalSlots: { label: '総応募枠数', category: 'facility' },
    remainingSlots: { label: '応募枠数(残)', category: 'facility' },
    applicationCount: { label: '応募数', category: 'common' },
    matchingCount: { label: 'マッチング数', category: 'common' },
    avgMatchingHours: { label: 'マッチング期間(時間)', category: 'common' },
    applicationsPerWorker: { label: 'ワーカーあたり応募数', category: 'worker' },
    matchingsPerWorker: { label: 'ワーカーあたりマッチング数', category: 'worker' },
    reviewsPerWorker: { label: 'ワーカーあたりレビュー数', category: 'worker' },
    parentJobsPerFacility: { label: '施設あたり親求人数', category: 'facility' },
    childJobsPerFacility: { label: '施設あたり子求人数', category: 'facility' },
    matchingsPerFacility: { label: '施設あたりマッチング数', category: 'facility' },
    reviewsPerFacility: { label: '施設あたりレビュー数', category: 'facility' },
    // 限定求人・オファー指標
    limitedJobCount: { label: '限定求人数', category: 'facility' },
    offerJobCount: { label: 'オファー数', category: 'facility' },
    offerAcceptanceRate: { label: 'オファー承諾率(%)', category: 'facility' },
    limitedJobApplicationRate: { label: '限定求人応募率(%)', category: 'facility' }
};

export default function MatchingAnalytics() {
    const { showDebugError } = useDebugError();
    const [data, setData] = useState<MatchingMetrics[]>([]);
    const [periodStats, setPeriodStats] = useState<{
        avgApplicationMatchingPeriod: number;
        avgJobMatchingPeriod: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [visibleMetrics, setVisibleMetrics] = useState({ worker: true, facility: true });
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
                facilityTypes: filtersToUse?.facilityTypes || undefined,
                regionId: filtersToUse?.regionId ? parseInt(filtersToUse.regionId) : undefined,
                requiresInterview: filtersToUse?.requiresInterview === 'true' ? true :
                    filtersToUse?.requiresInterview === 'false' ? false : undefined
            };
            // 表示/非表示ロジックを配列対応に更新
            const hasWorkerFilter = !!((filtersToUse?.ageRanges?.length > 0) ||
                (filtersToUse?.qualifications?.length > 0) ||
                (filtersToUse?.genders?.length > 0));
            const hasFacilityFilter = !!(filtersToUse?.facilityTypes?.length > 0);
            setVisibleMetrics({
                worker: !hasFacilityFilter || (!hasWorkerFilter && !hasFacilityFilter),
                facility: !hasWorkerFilter || (!hasWorkerFilter && !hasFacilityFilter)
            });

            const [result, stats] = await Promise.all([
                getMatchingAnalyticsData(filter),
                getMatchingPeriodStats()
            ]);
            setData(result);
            setPeriodStats(stats);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'マッチング分析データ取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { viewMode, filtersToUse }
            });
            console.error('Failed to fetch matching analytics:', error);
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

    // フィルターに応じて表示する指標を決定
    const getVisibleColumns = () => {
        return Object.entries(ALL_METRIC_LABELS).filter(([_, meta]) => {
            if (meta.category === 'common') return true;
            if (meta.category === 'worker') return visibleMetrics.worker;
            if (meta.category === 'facility') return visibleMetrics.facility;
            return true;
        });
    };

    const visibleColumns = getVisibleColumns();

    return (
        <div>
            <AnalyticsFilters
                showWorkerFilters={true}
                showFacilityFilters={true}
                showInterviewFilter={true}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onFilter={fetchData}
            />

            {/* Summary Cards */}
            {periodStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-xs text-slate-500 font-medium uppercase mb-1">応募 → マッチング平均</div>
                        <div className="text-2xl font-bold text-indigo-600">
                            {periodStats.avgApplicationMatchingPeriod.toFixed(1)} <span className="text-sm font-normal text-slate-500">時間</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">ワーカーが応募してからマッチングするまでの平均時間</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-xs text-slate-500 font-medium uppercase mb-1">求人公開 → 初回マッチング平均</div>
                        <div className="text-2xl font-bold text-emerald-600">
                            {periodStats.avgJobMatchingPeriod.toFixed(1)} <span className="text-sm font-normal text-slate-500">時間</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">求人が公開されてから最初のマッチングが成立するまでの平均時間</p>
                    </div>
                </div>
            )}

            {/* フィルター適用時の説明 */}
            {(!visibleMetrics.worker || !visibleMetrics.facility) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    {!visibleMetrics.facility && 'ワーカー属性でフィルター中のため、施設系指標は非表示です。'}
                    {!visibleMetrics.worker && '施設属性でフィルター中のため、ワーカー系指標は非表示です。'}
                </div>
            )}

            {/* データ表示エリア */}
            <div className="bg-white rounded-lg border border-slate-200">
                {/* トグルスイッチ（左上） */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-4">
                    <span className="text-sm text-slate-600">表示形式:</span>
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => handleViewModeChange('daily')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'daily'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            日次
                        </button>
                        <button
                            onClick={() => handleViewModeChange('monthly')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'monthly'
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
                                    {visibleColumns.map(([key, meta]) => (
                                        <th key={key} className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            {meta.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center text-slate-500">
                                            データがありません
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-900 sticky left-0 bg-white">
                                                {row.date}
                                            </td>
                                            {visibleColumns.map(([key]) => (
                                                <td key={key} className="px-4 py-3 text-sm text-slate-700 text-right">
                                                    {row[key as keyof MatchingMetrics]}
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
