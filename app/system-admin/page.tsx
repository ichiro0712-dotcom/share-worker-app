import { Suspense } from 'react';
import {
    getDashboardStats,
    getWorkerRegistrationTrends,
    getWorkerDemographics,
    getFacilityTypeStats
} from '@/src/lib/system-actions';
import LineChart from '@/components/system-admin/analytics/LineChart';
import PieChart from '@/components/system-admin/analytics/PieChart';
import BarChart from '@/components/system-admin/analytics/BarChart';
import { Users, Building2, Briefcase, Activity } from 'lucide-react';

export default async function SystemAdminDashboard() {
    const stats = await getDashboardStats();
    const trends = await getWorkerRegistrationTrends();
    const demographics = await getWorkerDemographics();
    const facilityTypes = await getFacilityTypeStats();

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
                <p className="text-slate-500">システム全体の概況を確認できます</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg mr-4 text-blue-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">登録ワーカー数</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalWorkers.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-center">
                    <div className="p-3 bg-indigo-100 rounded-lg mr-4 text-indigo-600">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">登録施設数</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalFacilities.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg mr-4 text-green-600">
                        <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">公開中求人数</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.activeJobs.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-center">
                    <div className="p-3 bg-orange-100 rounded-lg mr-4 text-orange-600">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">総応募数</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalApplications.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
                    <LineChart
                        title="ワーカー登録推移 (直近30日)"
                        labels={trends.map(t => t.date)}
                        data={trends.map(t => t.count)}
                        label="新規登録数"
                        color="rgb(59, 130, 246)"
                    />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <PieChart
                        title="ワーカー性別比率"
                        labels={demographics.gender.map(g => g.name)}
                        data={demographics.gender.map(g => g.value)}
                    />
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        title="施設種別割合"
                        labels={facilityTypes.map(f => f.name)}
                        data={facilityTypes.map(f => f.value)}
                    />
                </div>
            </div>

        </div>
    );
}
