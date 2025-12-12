import { Suspense } from 'react';
import {
    getDashboardKPIs,
    getDashboardTrends,
    getDashboardAlerts,
    getWorkerDemographics,
    getFacilityTypeStats
} from '@/src/lib/system-actions';
import DualAxisLineChart from '@/components/system-admin/analytics/DualAxisLineChart';
import DashboardAlerts from '@/components/system-admin/DashboardAlerts';
import PieChart from '@/components/system-admin/analytics/PieChart';
import BarChart from '@/components/system-admin/analytics/BarChart';
import { Users, Building2, Briefcase, Calendar, Target } from 'lucide-react';

export default async function SystemAdminDashboard() {
    const [kpis, trends, alerts, demographics, facilityTypes] = await Promise.all([
        getDashboardKPIs(),
        getDashboardTrends(),
        getDashboardAlerts(),
        getWorkerDemographics(),
        getFacilityTypeStats()
    ]);

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
                <p className="text-slate-500">システム全体の概況を確認できます</p>
            </div>

            {/* アラートセクション */}
            <DashboardAlerts alerts={alerts} />

            {/* KPI Cards - 5列 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {/* 登録ワーカー数 */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">登録ワーカー</p>
                            <p className="text-xl font-bold text-slate-800">{kpis.totalWorkers.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                {/* 登録施設数 */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">登録施設</p>
                            <p className="text-xl font-bold text-slate-800">{kpis.totalFacilities.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                {/* 親求人数 */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">親求人数</p>
                            <p className="text-xl font-bold text-slate-800">{kpis.activeParentJobs.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                {/* 子求人数 */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">子求人数</p>
                            <p className="text-xl font-bold text-slate-800">{kpis.totalChildJobs.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                {/* 残り応募枠 */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">応募枠数(残)</p>
                            <p className="text-xl font-bold text-slate-800">{kpis.totalRemainingSlots.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* トレンドグラフ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* グラフ1: 入会ワーカー数 + 施設登録数 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <DualAxisLineChart
                        title="新規登録推移 (直近30日)"
                        labels={trends.graph1.labels}
                        dataset1={{
                            label: '入会ワーカー',
                            data: trends.graph1.newWorkers,
                            color: 'rgb(59, 130, 246)' // blue
                        }}
                        dataset2={{
                            label: '施設登録',
                            data: trends.graph1.newFacilities,
                            color: 'rgb(16, 185, 129)' // emerald
                        }}
                    />
                </div>

                {/* グラフ2: 子求人数 + マッチング数 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <DualAxisLineChart
                        title="求人・マッチング推移"
                        labels={trends.graph2.labels}
                        dataset1={{
                            label: '新規求人(子)',
                            data: trends.graph2.childJobs,
                            color: 'rgb(249, 115, 22)' // orange
                        }}
                        dataset2={{
                            label: 'マッチング成立',
                            data: trends.graph2.matchings,
                            color: 'rgb(139, 92, 246)' // violet
                        }}
                    />
                </div>

                {/* グラフ3: ワーカーあたり応募数 + マッチング数 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <DualAxisLineChart
                        title="アクティビティ (Per Worker)"
                        labels={trends.graph3.labels}
                        dataset1={{
                            label: '平均応募数',
                            data: trends.graph3.applicationsPerWorker,
                            color: 'rgb(239, 68, 68)' // red
                        }}
                        dataset2={{
                            label: '平均マッチング',
                            data: trends.graph3.matchingsPerWorker,
                            color: 'rgb(59, 130, 246)' // blue
                        }}
                    />
                </div>

                {/* グラフ4: マッチング期間 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <DualAxisLineChart
                        title="平均マッチング所要時間 (Hours)"
                        labels={trends.graph4.labels}
                        dataset1={{
                            label: '所要時間',
                            data: trends.graph4.avgMatchingHours,
                            color: 'rgb(16, 185, 129)' // emerald
                        }}
                        singleAxis={true}
                    />
                </div>
            </div>

            {/* 人口統計グラフ (既存維持) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <PieChart
                        title="ワーカー性別比率"
                        labels={demographics.gender.map(g => g.name)}
                        data={demographics.gender.map(g => g.value)}
                    />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <PieChart
                        title="ワーカー年齢層"
                        labels={demographics.age.map(a => a.name)}
                        data={demographics.age.map(a => a.value)}
                    />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <BarChart
                        title="人気資格 (Top 5)"
                        labels={demographics.qualifications.map(q => q.name)}
                        data={demographics.qualifications.map(q => q.value)}
                        label="保有者数"
                        horizontal={true}
                    />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <PieChart
                        title="サービス種別割合"
                        labels={facilityTypes.map(f => f.name)}
                        data={facilityTypes.map(f => f.value)}
                    />
                </div>
            </div>
        </div>
    );
}
