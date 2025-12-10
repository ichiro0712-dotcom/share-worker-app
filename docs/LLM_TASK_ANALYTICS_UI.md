# 無料LLM向け指示書: アナリティクスUI実装

## 作業概要

システム管理画面のアナリティクス機能のUIコンポーネントを実装する。
バックエンド（Server Actions、DBスキーマ）は実装済み。

## 前提条件

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Server Actions は `src/lib/analytics-actions.ts` に実装済み

---

## 作業1: メインページの修正

### ファイル: `app/system-admin/analytics/page.tsx`

以下の内容で**完全に置き換え**てください：

```tsx
'use client';

import { useState } from 'react';
import WorkerAnalytics from './tabs/WorkerAnalytics';
import FacilityAnalytics from './tabs/FacilityAnalytics';
import MatchingAnalytics from './tabs/MatchingAnalytics';
import Link from 'next/link';

const TABS = [
    { id: 'worker', label: 'ワーカー分析' },
    { id: 'facility', label: '施設分析' },
    { id: 'matching', label: '応募・マッチング' },
] as const;

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState<string>('worker');

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">詳細アナリティクス</h1>
                    <p className="text-slate-500">プラットフォームの利用状況を詳細に分析します</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/system-admin/analytics/regions"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                    >
                        地域登録
                    </Link>
                    <Link
                        href="/system-admin/analytics/export"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                    >
                        スプレッドシートDL
                    </Link>
                    <Link
                        href="/system-admin/analytics/ai"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                    >
                        AI予測
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6 space-x-6">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-4 px-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'worker' && <WorkerAnalytics />}
                {activeTab === 'facility' && <FacilityAnalytics />}
                {activeTab === 'matching' && <MatchingAnalytics />}
            </div>
        </div>
    );
}
```

---

## 作業2: 共通フィルターコンポーネント作成

### ファイル: `components/system-admin/analytics/AnalyticsFilters.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { AGE_RANGES, FACILITY_TYPES, getAnalyticsRegions } from '@/src/lib/analytics-actions';
import { QUALIFICATION_OPTIONS } from '@/constants/job';

interface AnalyticsRegion {
    id: number;
    name: string;
}

interface FilterValues {
    viewMode: 'daily' | 'monthly';
    targetYear: number;
    targetMonth: number;
    startDate: string;
    endDate: string;
    ageRange: string;
    qualification: string;
    facilityType: string;
    regionId: string;
    requiresInterview: string;
}

interface Props {
    showWorkerFilters?: boolean;
    showFacilityFilters?: boolean;
    showInterviewFilter?: boolean;
    onFilter: (filters: FilterValues) => void;
}

export default function AnalyticsFilters({
    showWorkerFilters = false,
    showFacilityFilters = false,
    showInterviewFilter = false,
    onFilter
}: Props) {
    const now = new Date();
    const [regions, setRegions] = useState<AnalyticsRegion[]>([]);
    const [filters, setFilters] = useState<FilterValues>({
        viewMode: 'daily',
        targetYear: now.getFullYear(),
        targetMonth: now.getMonth() + 1,
        startDate: '',
        endDate: '',
        ageRange: '',
        qualification: '',
        facilityType: '',
        regionId: '',
        requiresInterview: ''
    });

    useEffect(() => {
        getAnalyticsRegions().then(setRegions);
    }, []);

    const handleChange = (key: keyof FilterValues, value: string | number) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        onFilter(filters);
    };

    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {/* 表示形式 */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1">表示形式</label>
                    <select
                        value={filters.viewMode}
                        onChange={e => handleChange('viewMode', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="daily">日次</option>
                        <option value="monthly">月次</option>
                    </select>
                </div>

                {/* 年選択 */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1">年</label>
                    <select
                        value={filters.targetYear}
                        onChange={e => handleChange('targetYear', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}年</option>
                        ))}
                    </select>
                </div>

                {/* 月選択（日次の場合のみ） */}
                {filters.viewMode === 'daily' && (
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">月</label>
                        <select
                            value={filters.targetMonth}
                            onChange={e => handleChange('targetMonth', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            {months.map(m => (
                                <option key={m} value={m}>{m}月</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 期間指定（オプション） */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1">開始日</label>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={e => handleChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">終了日</label>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={e => handleChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>

                {/* 地域 */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1">地域</label>
                    <select
                        value={filters.regionId}
                        onChange={e => handleChange('regionId', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="">すべて</option>
                        {regions.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {/* ワーカーフィルター */}
                {showWorkerFilters && (
                    <>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">年齢層</label>
                            <select
                                value={filters.ageRange}
                                onChange={e => handleChange('ageRange', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                                <option value="">すべて</option>
                                {AGE_RANGES.map(a => (
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">保有資格</label>
                            <select
                                value={filters.qualification}
                                onChange={e => handleChange('qualification', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                                <option value="">すべて</option>
                                {QUALIFICATION_OPTIONS.map(q => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {/* 施設フィルター */}
                {showFacilityFilters && (
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">施設種類</label>
                        <select
                            value={filters.facilityType}
                            onChange={e => handleChange('facilityType', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">すべて</option>
                            {FACILITY_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 面接ありフィルター */}
                {showInterviewFilter && (
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">面接あり</label>
                        <select
                            value={filters.requiresInterview}
                            onChange={e => handleChange('requiresInterview', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">すべて</option>
                            <option value="true">面接あり</option>
                            <option value="false">面接なし</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                >
                    更新
                </button>
            </div>
        </div>
    );
}
```

---

## 作業3: ワーカー分析タブ

### ファイル: `app/system-admin/analytics/tabs/WorkerAnalytics.tsx`

**完全に置き換え**てください：

```tsx
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

    const fetchData = async (filterValues?: any) => {
        setLoading(true);
        try {
            const filter: AnalyticsFilter = {
                viewMode: filterValues?.viewMode || 'daily',
                targetYear: filterValues?.targetYear,
                targetMonth: filterValues?.targetMonth,
                startDate: filterValues?.startDate ? new Date(filterValues.startDate) : undefined,
                endDate: filterValues?.endDate ? new Date(filterValues.endDate) : undefined,
                ageRange: filterValues?.ageRange || undefined,
                qualification: filterValues?.qualification || undefined,
                regionId: filterValues?.regionId ? parseInt(filterValues.regionId) : undefined
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
    }, []);

    return (
        <div>
            <AnalyticsFilters
                showWorkerFilters={true}
                onFilter={fetchData}
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                                    日付
                                </th>
                                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                                    <th key={key} className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data.map((row, idx) => (
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
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

---

## 作業4: 施設分析タブ

### ファイル: `app/system-admin/analytics/tabs/FacilityAnalytics.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getFacilityAnalyticsData, FacilityMetrics, AnalyticsFilter } from '@/src/lib/analytics-actions';
import AnalyticsFilters from '@/components/system-admin/analytics/AnalyticsFilters';

const METRIC_LABELS: Record<keyof Omit<FacilityMetrics, 'date'>, string> = {
    registeredCount: '登録施設数',
    newCount: '入会施設数',
    withdrawnCount: '退会施設数',
    reviewCount: 'レビュー数',
    reviewAvg: 'レビュー平均点',
    dropoutRate: '登録離脱率(%)',
    withdrawalRate: '退会率(%)',
    parentJobCount: '親求人数',
    parentJobInterviewCount: '親求人数(面接あり)',
    childJobCount: '子求人数',
    childJobInterviewCount: '子求人数(面接あり)'
};

export default function FacilityAnalytics() {
    const [data, setData] = useState<FacilityMetrics[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async (filterValues?: any) => {
        setLoading(true);
        try {
            const filter: AnalyticsFilter = {
                viewMode: filterValues?.viewMode || 'daily',
                targetYear: filterValues?.targetYear,
                targetMonth: filterValues?.targetMonth,
                startDate: filterValues?.startDate ? new Date(filterValues.startDate) : undefined,
                endDate: filterValues?.endDate ? new Date(filterValues.endDate) : undefined,
                facilityType: filterValues?.facilityType || undefined,
                regionId: filterValues?.regionId ? parseInt(filterValues.regionId) : undefined
            };
            const result = await getFacilityAnalyticsData(filter);
            setData(result);
        } catch (error) {
            console.error('Failed to fetch facility analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div>
            <AnalyticsFilters
                showFacilityFilters={true}
                onFilter={fetchData}
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                                    日付
                                </th>
                                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                                    <th key={key} className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-900 sticky left-0 bg-white">
                                        {row.date}
                                    </td>
                                    {Object.keys(METRIC_LABELS).map(key => (
                                        <td key={key} className="px-4 py-3 text-sm text-slate-700 text-right">
                                            {row[key as keyof FacilityMetrics]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

---

## 作業5: 応募・マッチング分析タブ

### ファイル: `app/system-admin/analytics/tabs/MatchingAnalytics.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getMatchingAnalyticsData, getVisibleMetrics, MatchingMetrics, AnalyticsFilter } from '@/src/lib/analytics-actions';
import AnalyticsFilters from '@/components/system-admin/analytics/AnalyticsFilters';

const ALL_METRIC_LABELS: Record<string, { label: string; category: 'common' | 'worker' | 'facility' }> = {
    parentJobCount: { label: '親求人数', category: 'facility' },
    childJobCount: { label: '子求人数', category: 'facility' },
    applicationCount: { label: '応募数', category: 'common' },
    matchingCount: { label: 'マッチング数', category: 'common' },
    avgMatchingHours: { label: 'マッチング期間(時間)', category: 'common' },
    applicationsPerWorker: { label: 'ワーカーあたり応募数', category: 'worker' },
    matchingsPerWorker: { label: 'ワーカーあたりマッチング数', category: 'worker' },
    reviewsPerWorker: { label: 'ワーカーあたりレビュー数', category: 'worker' },
    parentJobsPerFacility: { label: '施設あたり親求人数', category: 'facility' },
    childJobsPerFacility: { label: '施設あたり子求人数', category: 'facility' },
    matchingsPerFacility: { label: '施設あたりマッチング数', category: 'facility' },
    reviewsPerFacility: { label: '施設あたりレビュー数', category: 'facility' }
};

export default function MatchingAnalytics() {
    const [data, setData] = useState<MatchingMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [visibleMetrics, setVisibleMetrics] = useState({ worker: true, facility: true });
    const [currentFilter, setCurrentFilter] = useState<AnalyticsFilter>({ viewMode: 'daily' });

    const fetchData = async (filterValues?: any) => {
        setLoading(true);
        try {
            const filter: AnalyticsFilter = {
                viewMode: filterValues?.viewMode || 'daily',
                targetYear: filterValues?.targetYear,
                targetMonth: filterValues?.targetMonth,
                startDate: filterValues?.startDate ? new Date(filterValues.startDate) : undefined,
                endDate: filterValues?.endDate ? new Date(filterValues.endDate) : undefined,
                ageRange: filterValues?.ageRange || undefined,
                qualification: filterValues?.qualification || undefined,
                facilityType: filterValues?.facilityType || undefined,
                regionId: filterValues?.regionId ? parseInt(filterValues.regionId) : undefined,
                requiresInterview: filterValues?.requiresInterview === 'true' ? true :
                                   filterValues?.requiresInterview === 'false' ? false : undefined
            };
            setCurrentFilter(filter);
            setVisibleMetrics(getVisibleMetrics(filter));
            const result = await getMatchingAnalyticsData(filter);
            setData(result);
        } catch (error) {
            console.error('Failed to fetch matching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                onFilter={fetchData}
            />

            {/* フィルター適用時の説明 */}
            {(!visibleMetrics.worker || !visibleMetrics.facility) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    {!visibleMetrics.facility && 'ワーカー属性でフィルター中のため、施設系指標は非表示です。'}
                    {!visibleMetrics.worker && '施設属性でフィルター中のため、ワーカー系指標は非表示です。'}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                                    日付
                                </th>
                                {visibleColumns.map(([key, meta]) => (
                                    <th key={key} className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        {meta.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data.map((row, idx) => (
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
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

---

## 作業6: 地域登録ページ

### ファイル: `app/system-admin/analytics/regions/page.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getAnalyticsRegions, createAnalyticsRegion, updateAnalyticsRegion, deleteAnalyticsRegion, PREFECTURES } from '@/src/lib/analytics-actions';
import Link from 'next/link';

interface Region {
    id: number;
    name: string;
    prefectures: string[];
    cities: string[];
}

export default function RegionsPage() {
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        prefectures: [] as string[],
        cities: ''
    });

    const fetchRegions = async () => {
        setLoading(true);
        try {
            const data = await getAnalyticsRegions();
            setRegions(data);
        } catch (error) {
            console.error('Failed to fetch regions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegions();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                name: formData.name,
                prefectures: formData.prefectures,
                cities: formData.cities.split(',').map(c => c.trim()).filter(Boolean)
            };
            if (editingId) {
                await updateAnalyticsRegion(editingId, data);
            } else {
                await createAnalyticsRegion(data);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', prefectures: [], cities: '' });
            fetchRegions();
        } catch (error) {
            console.error('Failed to save region:', error);
        }
    };

    const handleEdit = (region: Region) => {
        setEditingId(region.id);
        setFormData({
            name: region.name,
            prefectures: region.prefectures,
            cities: region.cities.join(', ')
        });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('この地域を削除しますか？')) return;
        try {
            await deleteAnalyticsRegion(id);
            fetchRegions();
        } catch (error) {
            console.error('Failed to delete region:', error);
        }
    };

    const togglePrefecture = (pref: string) => {
        setFormData(prev => ({
            ...prev,
            prefectures: prev.prefectures.includes(pref)
                ? prev.prefectures.filter(p => p !== pref)
                : [...prev.prefectures, pref]
        }));
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">地域登録</h1>
                    <p className="text-slate-500">アナリティクスで使用する地域を登録します</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/system-admin/analytics"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                    >
                        戻る
                    </Link>
                    <button
                        onClick={() => {
                            setShowForm(true);
                            setEditingId(null);
                            setFormData({ name: '', prefectures: [], cities: '' });
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                    >
                        新規登録
                    </button>
                </div>
            </div>

            {/* フォーム */}
            {showForm && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">
                        {editingId ? '地域を編集' : '新規地域登録'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                地域名
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="例: 東京都心部"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                都道府県（複数選択可）
                            </label>
                            <div className="flex flex-wrap gap-2 p-3 border border-slate-300 rounded-lg max-h-40 overflow-y-auto">
                                {PREFECTURES.map(pref => (
                                    <button
                                        key={pref}
                                        type="button"
                                        onClick={() => togglePrefecture(pref)}
                                        className={`px-2 py-1 text-xs rounded ${
                                            formData.prefectures.includes(pref)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    >
                                        {pref}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                市区町村（カンマ区切り、オプション）
                            </label>
                            <input
                                type="text"
                                value={formData.cities}
                                onChange={e => setFormData(prev => ({ ...prev, cities: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="例: 千代田区, 中央区, 港区"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                            >
                                {editingId ? '更新' : '登録'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                            >
                                キャンセル
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 一覧 */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : regions.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    登録された地域はありません
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-slate-200">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">地域名</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">都道府県</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">市区町村</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {regions.map(region => (
                                <tr key={region.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-900">{region.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                        {region.prefectures.join(', ')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                        {region.cities.length > 0 ? region.cities.join(', ') : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleEdit(region)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                                        >
                                            編集
                                        </button>
                                        <button
                                            onClick={() => handleDelete(region.id)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

---

## 作業7: スプレッドシートDLページ

### ファイル: `app/system-admin/analytics/export/page.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getExportData, AnalyticsFilter } from '@/src/lib/analytics-actions';

const WORKER_METRICS = [
    { key: 'registeredCount', label: '登録ワーカー数' },
    { key: 'newCount', label: '入会ワーカー数' },
    { key: 'withdrawnCount', label: '退会ワーカー数' },
    { key: 'reviewCount', label: 'レビュー数' },
    { key: 'reviewAvg', label: 'レビュー平均点' },
    { key: 'cancelRate', label: 'キャンセル率' },
    { key: 'lastMinuteCancelRate', label: '直前キャンセル率' },
    { key: 'withdrawalRate', label: '退会率' }
];

const FACILITY_METRICS = [
    { key: 'registeredCount', label: '登録施設数' },
    { key: 'newCount', label: '入会施設数' },
    { key: 'withdrawnCount', label: '退会施設数' },
    { key: 'reviewCount', label: 'レビュー数' },
    { key: 'reviewAvg', label: 'レビュー平均点' },
    { key: 'parentJobCount', label: '親求人数' },
    { key: 'childJobCount', label: '子求人数' }
];

const MATCHING_METRICS = [
    { key: 'applicationCount', label: '応募数' },
    { key: 'matchingCount', label: 'マッチング数' },
    { key: 'avgMatchingHours', label: 'マッチング期間' },
    { key: 'applicationsPerWorker', label: 'ワーカーあたり応募数' },
    { key: 'matchingsPerWorker', label: 'ワーカーあたりマッチング数' }
];

export default function ExportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedWorker, setSelectedWorker] = useState<string[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string[]>([]);
    const [selectedMatching, setSelectedMatching] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleMetric = (
        key: string,
        selected: string[],
        setSelected: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        setSelected(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleExport = async () => {
        if (!startDate || !endDate) {
            alert('期間を指定してください');
            return;
        }
        if (selectedWorker.length === 0 && selectedFacility.length === 0 && selectedMatching.length === 0) {
            alert('少なくとも1つの指標を選択してください');
            return;
        }

        setLoading(true);
        try {
            const filter: AnalyticsFilter = { viewMode: 'daily' };
            const data = await getExportData({
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                metrics: {
                    worker: selectedWorker,
                    facility: selectedFacility,
                    matching: selectedMatching
                },
                filter
            });

            // CSVを生成
            const rows: string[][] = [];
            const headers = ['日付'];

            if (data.workerData.length > 0) {
                selectedWorker.forEach(key => {
                    const label = WORKER_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`ワーカー_${label}`);
                });
            }
            if (data.facilityData.length > 0) {
                selectedFacility.forEach(key => {
                    const label = FACILITY_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`施設_${label}`);
                });
            }
            if (data.matchingData.length > 0) {
                selectedMatching.forEach(key => {
                    const label = MATCHING_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`マッチング_${label}`);
                });
            }
            rows.push(headers);

            const maxLength = Math.max(
                data.workerData.length,
                data.facilityData.length,
                data.matchingData.length
            );

            for (let i = 0; i < maxLength; i++) {
                const row: string[] = [];
                const date = data.workerData[i]?.date || data.facilityData[i]?.date || data.matchingData[i]?.date || '';
                row.push(date);

                if (data.workerData.length > 0) {
                    selectedWorker.forEach(key => {
                        row.push(String(data.workerData[i]?.[key as keyof typeof data.workerData[0]] ?? ''));
                    });
                }
                if (data.facilityData.length > 0) {
                    selectedFacility.forEach(key => {
                        row.push(String(data.facilityData[i]?.[key as keyof typeof data.facilityData[0]] ?? ''));
                    });
                }
                if (data.matchingData.length > 0) {
                    selectedMatching.forEach(key => {
                        row.push(String(data.matchingData[i]?.[key as keyof typeof data.matchingData[0]] ?? ''));
                    });
                }
                rows.push(row);
            }

            // BOMを追加してExcelで文字化けしないようにする
            const bom = '\uFEFF';
            const csv = bom + rows.map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics_${startDate}_${endDate}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('エクスポートに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">スプレッドシートDL</h1>
                    <p className="text-slate-500">アナリティクスデータをCSVでダウンロードします</p>
                </div>
                <Link
                    href="/system-admin/analytics"
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                >
                    戻る
                </Link>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
                {/* 期間指定 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">期間指定</h3>
                    <div className="flex gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">開始日</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">終了日</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* ワーカー指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">ワーカー指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {WORKER_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedWorker, setSelectedWorker)}
                                className={`px-3 py-1 text-sm rounded ${
                                    selectedWorker.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 施設指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">施設指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {FACILITY_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedFacility, setSelectedFacility)}
                                className={`px-3 py-1 text-sm rounded ${
                                    selectedFacility.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* マッチング指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">マッチング指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {MATCHING_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedMatching, setSelectedMatching)}
                                className={`px-3 py-1 text-sm rounded ${
                                    selectedMatching.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
                >
                    {loading ? 'ダウンロード中...' : 'CSVダウンロード'}
                </button>
            </div>
        </div>
    );
}
```

---

## 作業8: AI予測ページ（ダミー実装）

### ファイル: `app/system-admin/analytics/ai/page.tsx`

**新規作成**してください：

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AIPage() {
    const [inputs, setInputs] = useState({
        facilityCount: '',
        jobCount: '',
        workerCount: '',
        matchingPeriod: '',
        matchingCount: ''
    });
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = () => {
        setLoading(true);
        // ダミー実装：2秒後にダミーデータを表示
        setTimeout(() => {
            setResult({
                predictedFacilityCount: inputs.facilityCount || Math.floor(Math.random() * 100 + 50),
                predictedJobCount: inputs.jobCount || Math.floor(Math.random() * 500 + 200),
                predictedWorkerCount: inputs.workerCount || Math.floor(Math.random() * 1000 + 500),
                predictedMatchingPeriod: inputs.matchingPeriod || (Math.random() * 24 + 12).toFixed(1),
                predictedMatchingCount: inputs.matchingCount || Math.floor(Math.random() * 300 + 100),
                confidence: (Math.random() * 20 + 70).toFixed(1)
            });
            setLoading(false);
        }, 2000);
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">マッチング最適化AI</h1>
                    <p className="text-slate-500">過去データから将来の指標を予測します</p>
                </div>
                <Link
                    href="/system-admin/analytics"
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                >
                    戻る
                </Link>
            </div>

            {/* 未実装の警告 */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">LLM接続が未実装です</span>
                </div>
                <p className="mt-1 text-sm text-amber-700">
                    現在はダミーデータを表示しています。将来的にはLLM APIと接続して実際の予測を行います。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 入力フォーム */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">入力パラメータ</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        予測したい項目は空欄にし、既知の項目を入力してください。
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                施設数
                            </label>
                            <input
                                type="number"
                                value={inputs.facilityCount}
                                onChange={e => setInputs(prev => ({ ...prev, facilityCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                求人数
                            </label>
                            <input
                                type="number"
                                value={inputs.jobCount}
                                onChange={e => setInputs(prev => ({ ...prev, jobCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ワーカー数
                            </label>
                            <input
                                type="number"
                                value={inputs.workerCount}
                                onChange={e => setInputs(prev => ({ ...prev, workerCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                マッチング期間（時間）
                            </label>
                            <input
                                type="number"
                                value={inputs.matchingPeriod}
                                onChange={e => setInputs(prev => ({ ...prev, matchingPeriod: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                マッチング数
                            </label>
                            <input
                                type="number"
                                value={inputs.matchingCount}
                                onChange={e => setInputs(prev => ({ ...prev, matchingCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handlePredict}
                        disabled={loading}
                        className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
                    >
                        {loading ? '予測中...' : '予測する'}
                    </button>
                </div>

                {/* 結果表示 */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">予測結果</h2>

                    {!result ? (
                        <div className="text-center py-12 text-slate-400">
                            パラメータを入力して「予測する」をクリックしてください
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測施設数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedFacilityCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測求人数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedJobCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測ワーカー数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedWorkerCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測マッチング期間</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedMatchingPeriod}時間
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測マッチング数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedMatchingCount}
                                </div>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <div className="text-xs text-indigo-500">予測信頼度</div>
                                <div className="text-xl font-bold text-indigo-600">
                                    {result.confidence}%
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

---

## 作業9: 既存ファイルの削除

以下のファイルは不要になったので**削除**してください：

- `app/system-admin/analytics/tabs/UserAnalytics.tsx`
- `app/system-admin/analytics/tabs/JobAnalytics.tsx`

---

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```

### 2. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
```bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
以下のURLでそれぞれ動作確認：
- http://localhost:3000/system-admin/analytics
- http://localhost:3000/system-admin/analytics/regions
- http://localhost:3000/system-admin/analytics/export
- http://localhost:3000/system-admin/analytics/ai

確認ポイント：
- 各タブ（ワーカー/施設/マッチング）が切り替わるか
- フィルターの「更新」ボタンでデータが再取得されるか
- 地域登録で追加・編集・削除ができるか
- CSVダウンロードが動作するか
- AI予測でダミー結果が表示されるか

### 5. 変更ファイルの報告
変更・作成・削除したファイル一覧を報告すること。

---

## ディレクトリ構成（完成形）

```
app/system-admin/analytics/
├── page.tsx                    # メインページ（修正）
├── tabs/
│   ├── WorkerAnalytics.tsx     # ワーカー分析（修正）
│   ├── FacilityAnalytics.tsx   # 施設分析（新規）
│   └── MatchingAnalytics.tsx   # マッチング分析（新規）
├── regions/
│   └── page.tsx                # 地域登録（新規）
├── export/
│   └── page.tsx                # スプレッドシートDL（新規）
└── ai/
    └── page.tsx                # AI予測（新規）

components/system-admin/
└── analytics/
    └── AnalyticsFilters.tsx    # フィルターコンポーネント（新規）
```

---

## 注意事項

- **Server Actionsは実装済み**なので、バックエンドのコードは変更しないでください
- **Tailwind CSSクラス**のみを使用してスタイリングしてください
- **日本語**でUIテキストを記述してください
- **エラーハンドリング**を適切に行ってください（try-catch）
