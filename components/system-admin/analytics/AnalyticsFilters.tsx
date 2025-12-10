'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getAnalyticsRegions, RegionData } from '@/src/lib/analytics-actions';
import { AGE_RANGES, GENDERS } from '@/src/lib/analytics-constants';
import { SERVICE_CATEGORY_LIST } from '@/constants/serviceTypes';
import { QUALIFICATION_GROUPS, WORKER_QUALIFICATIONS } from '@/constants/qualifications';

export interface FilterValues {
    viewMode: 'daily' | 'monthly';
    startDate: string;
    endDate: string;
    ageRanges: string[];
    qualifications: string[];
    genders: string[];
    facilityTypes: string[];
    regionId: string;
    requiresInterview: string;
}

interface Props {
    showWorkerFilters?: boolean;
    showFacilityFilters?: boolean;
    showInterviewFilter?: boolean;
    viewMode: 'daily' | 'monthly';
    onViewModeChange: (mode: 'daily' | 'monthly') => void;
    onFilter: (filters: Omit<FilterValues, 'viewMode'>) => void;
}

export default function AnalyticsFilters({
    showWorkerFilters = false,
    showFacilityFilters = false,
    showInterviewFilter = false,
    viewMode,
    onViewModeChange,
    onFilter
}: Props) {
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [filters, setFilters] = useState<Omit<FilterValues, 'viewMode'>>({
        startDate: '',
        endDate: '',
        ageRanges: [],
        qualifications: [],
        genders: [],
        facilityTypes: [],
        regionId: '',
        requiresInterview: ''
    });

    useEffect(() => {
        getAnalyticsRegions().then(setRegions);
    }, []);

    const handleChange = (key: 'startDate' | 'endDate' | 'regionId' | 'requiresInterview', value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleCheckboxChange = (key: 'ageRanges' | 'qualifications' | 'genders' | 'facilityTypes', value: string) => {
        setFilters(prev => {
            const currentValues = prev[key];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [key]: newValues };
        });
    };

    const handleSubmit = () => {
        onFilter(filters);
    };

    // 詳細フィルターの選択数をカウント
    const detailFilterCount =
        filters.ageRanges.length +
        filters.qualifications.length +
        filters.genders.length +
        filters.facilityTypes.length +
        (filters.requiresInterview ? 1 : 0);

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            {/* 1行目: 開始日・終了日・地域・更新 */}
            <div className="flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-slate-500 mb-1">開始日</label>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={e => handleChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-slate-500 mb-1">終了日</label>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={e => handleChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>
                <div className="flex-1 min-w-[140px]">
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
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                >
                    更新
                </button>
            </div>

            {/* 詳細フィルター折りたたみトグル */}
            {(showWorkerFilters || showFacilityFilters || showInterviewFilter) && (
                <div className="mt-4">
                    <button
                        onClick={() => setIsDetailOpen(!isDetailOpen)}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition font-medium"
                    >
                        {isDetailOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>詳細フィルター</span>
                        {detailFilterCount > 0 && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                {detailFilterCount}件選択中
                            </span>
                        )}
                    </button>

                    {/* 詳細フィルター内容 */}
                    {isDetailOpen && (
                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-6">
                            {/* ワーカーフィルター */}
                            {showWorkerFilters && (
                                <>
                                    {/* 年齢層 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">年齢層</label>
                                        <div className="flex flex-wrap gap-4">
                                            {AGE_RANGES.map(a => (
                                                <label
                                                    key={a.value}
                                                    className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.ageRanges.includes(a.value)}
                                                        onChange={() => handleCheckboxChange('ageRanges', a.value)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                    {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 性別 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">性別</label>
                                        <div className="flex flex-wrap gap-4">
                                            {GENDERS.map(g => (
                                                <label
                                                    key={g.value}
                                                    className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.genders.includes(g.value)}
                                                        onChange={() => handleCheckboxChange('genders', g.value)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                    {g.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 保有資格 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">保有資格</label>
                                        <div className="space-y-4">
                                            {QUALIFICATION_GROUPS.map(group => (
                                                <div key={group.name}>
                                                    <h4 className="text-xs font-semibold text-slate-500 mb-2">{group.name}</h4>
                                                    <div className="flex flex-wrap gap-3">
                                                        {group.qualifications.map(q => (
                                                            <label
                                                                key={q}
                                                                className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.qualifications.includes(q)}
                                                                    onChange={() => handleCheckboxChange('qualifications', q)}
                                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                                />
                                                                {q}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 施設フィルター */}
                            {showFacilityFilters && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-2">サービス種別</label>
                                    <div className="flex flex-wrap gap-4">
                                        {SERVICE_CATEGORY_LIST.map(t => (
                                            <label
                                                key={t}
                                                className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={filters.facilityTypes.includes(t)}
                                                    onChange={() => handleCheckboxChange('facilityTypes', t)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                />
                                                {t}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 面接ありフィルター */}
                            {showInterviewFilter && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-2">面接</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { value: '', label: 'すべて' },
                                            { value: 'true', label: '面接あり' },
                                            { value: 'false', label: '面接なし' }
                                        ].map(opt => (
                                            <label
                                                key={opt.value}
                                                className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                            >
                                                <input
                                                    type="radio"
                                                    name="requiresInterview"
                                                    checked={filters.requiresInterview === opt.value}
                                                    onChange={() => handleChange('requiresInterview', opt.value)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
