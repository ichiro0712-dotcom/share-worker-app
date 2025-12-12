'use client';

import { useState } from 'react';
import WorkerAnalytics from './tabs/WorkerAnalytics';
import FacilityAnalytics from './tabs/FacilityAnalytics';
import MatchingAnalytics from './tabs/MatchingAnalytics';
import MetricDefinitions from './tabs/MetricDefinitions';
import Link from 'next/link';
import { Book } from 'lucide-react';

const TABS = [
    { id: 'worker', label: 'ワーカー分析' },
    { id: 'facility', label: '施設分析' },
    { id: 'matching', label: '応募・マッチング' },
    { id: 'definitions', label: '定義一覧', icon: Book },
] as const;

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState<string>('worker');

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">アナリティクス</h1>
                    <p className="text-slate-500">プラットフォームの利用状況を分析します</p>
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
                {TABS.map(tab => {
                    const Icon = 'icon' in tab ? tab.icon : null;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 px-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab.id
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {Icon && <Icon className="w-4 h-4" />}
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'worker' && <WorkerAnalytics />}
                {activeTab === 'facility' && <FacilityAnalytics />}
                {activeTab === 'matching' && <MatchingAnalytics />}
                {activeTab === 'definitions' && <MetricDefinitions />}
            </div>
        </div>
    );
}
