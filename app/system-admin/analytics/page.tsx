'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import WorkerAnalytics from './tabs/WorkerAnalytics';
import FacilityAnalytics from './tabs/FacilityAnalytics';
import MatchingAnalytics from './tabs/MatchingAnalytics';
import JobAnalytics from './tabs/JobAnalytics';
import LpTracking from './tabs/LpTracking';
import FunnelAnalytics from './tabs/FunnelAnalytics';
import MetricDefinitions from './tabs/MetricDefinitions';
import GA4Analytics from './tabs/GA4Analytics';
import Link from 'next/link';
import { Table, BarChart3, Filter, LineChart, ExternalLink } from 'lucide-react';

const TABS = [
    { id: 'worker', label: 'ワーカー分析' },
    { id: 'facility', label: '施設分析' },
    { id: 'matching', label: '応募・マッチング' },
    { id: 'jobs', label: '求人' },
    { id: 'lp', label: 'LP', icon: BarChart3 },
    { id: 'funnel', label: '登録動線', icon: Filter },
    { id: 'ga4', label: 'GA4', icon: LineChart },
    { id: 'definitions', label: '全指標一覧', icon: Table },
] as const;

// 後方互換: 旧タブIDを新IDにマッピング
const TAB_ALIASES: Record<string, string> = {
    'lp-tracking': 'lp',
    'public-jobs': 'lp',
};

const resolveTab = (tab: string | null): string => {
    if (!tab) return 'worker';
    const resolved = TAB_ALIASES[tab] || tab;
    return TABS.some(t => t.id === resolved) ? resolved : 'worker';
};

export default function AnalyticsPage() {
    const searchParams = useSearchParams();
    const initialTab = resolveTab(searchParams?.get('tab'));
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    // 一度訪問したタブを記録（display:noneで非表示にし、アンマウントしない）
    const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([initialTab]));

    // タブ切り替え時にmountedTabsに追加
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        setMountedTabs(prev => {
            if (prev.has(tabId)) return prev;
            const next = new Set(prev);
            next.add(tabId);
            return next;
        });
    };

    // URLのtabパラメータが変更された場合に追従
    useEffect(() => {
        const tab = searchParams?.get('tab');
        if (tab) {
            const resolved = resolveTab(tab);
            handleTabChange(resolved);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">アナリティクス</h1>
                    <p className="text-slate-500">プラットフォームの利用状況を分析します</p>
                </div>
                <div className="flex gap-3">
                    <a
                        href="https://analytics.google.com/analytics/web/#/p522574288/reports/intelligenthome"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm flex items-center gap-1.5"
                    >
                        GA4
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
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
            <div className="flex border-b border-slate-200 mb-6 space-x-6 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = 'icon' in tab ? tab.icon : null;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
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

            {/* Content — display:noneで非表示にし、タブ切替時にアンマウントしない（期間設定を保持） */}
            <div className="min-h-[500px]">
                {mountedTabs.has('worker') && <div style={{ display: activeTab === 'worker' ? 'block' : 'none' }}><WorkerAnalytics /></div>}
                {mountedTabs.has('facility') && <div style={{ display: activeTab === 'facility' ? 'block' : 'none' }}><FacilityAnalytics /></div>}
                {mountedTabs.has('matching') && <div style={{ display: activeTab === 'matching' ? 'block' : 'none' }}><MatchingAnalytics /></div>}
                {mountedTabs.has('jobs') && <div style={{ display: activeTab === 'jobs' ? 'block' : 'none' }}><JobAnalytics /></div>}
                {mountedTabs.has('lp') && <div style={{ display: activeTab === 'lp' ? 'block' : 'none' }}><LpTracking /></div>}
                {mountedTabs.has('funnel') && <div style={{ display: activeTab === 'funnel' ? 'block' : 'none' }}><FunnelAnalytics /></div>}
                {mountedTabs.has('ga4') && <div style={{ display: activeTab === 'ga4' ? 'block' : 'none' }}><GA4Analytics /></div>}
                {mountedTabs.has('definitions') && <div style={{ display: activeTab === 'definitions' ? 'block' : 'none' }}><MetricDefinitions /></div>}
            </div>
        </div>
    );
}
