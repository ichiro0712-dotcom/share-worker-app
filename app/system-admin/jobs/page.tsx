'use client';

import { useState, useEffect } from 'react';
import {
    getSystemJobsExtended,
    generateMasqueradeToken,
    toggleJobRecruitmentClosed
} from '@/src/lib/system-actions';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import {
    Search,
    Filter,
    Eye,
    Edit,
    ArrowUpDown,
    Briefcase,
    RefreshCw,
    Building2,
    XCircle,
    RotateCcw
} from 'lucide-react';
import { PREFECTURES } from '@/constants/job';
import { getCitiesByPrefecture, Prefecture } from '@/constants/prefectureCities';
import { SERVICE_TYPES } from '@/constants/serviceTypes';
import { JOB_QUALIFICATION_OPTIONS } from '@/constants/qualifications';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

// 返されるデータ型
interface Job {
    id: number;
    title: string;
    status: 'DRAFT' | 'PUBLISHED' | 'STOPPED' | 'WORKING' | 'COMPLETED' | 'CANCELLED';
    facilityId: number;
    facilityName: string;
    facilityType: string;
    templateName: string | null;
    requiresInterview: boolean;
    isRecruitmentClosed: boolean;
    applicationSlots: number;    // 応募枠（全勤務日の募集人数合計）
    applicationCount: number;    // 応募数
    matchingPeriod: number | null;  // マッチング期間（時間）
    createdAt: Date;
    updatedAt: Date;
}

type SortField = 'status' | 'applicationSlots' | 'applicationCount' | 'created_at' | 'matchingPeriod';
type SortOrder = 'asc' | 'desc';

const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-green-100 text-green-700',
    STOPPED: 'bg-red-100 text-red-700',
    WORKING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
    DRAFT: '下書き',
    PUBLISHED: '公開中',
    STOPPED: '停止',
    WORKING: '勤務中',
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
};

export default function SystemAdminJobsPage() {
    const { showDebugError } = useDebugError();
    const { admin } = useSystemAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [prefectureFilter, setPrefectureFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState('');
    const [interviewFilter, setInterviewFilter] = useState<'all' | 'true' | 'false'>('all');
    const [qualificationFilter, setQualificationFilter] = useState('');

    // Sort
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const filters = {
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                startDate: startDateFilter || undefined,
                endDate: endDateFilter || undefined,
                prefecture: prefectureFilter || undefined,
                city: cityFilter || undefined,
                facilityType: serviceTypeFilter || undefined,
                requiresInterview: interviewFilter === 'all' ? undefined : interviewFilter === 'true',
                qualification: qualificationFilter || undefined,
            };

            const data = await getSystemJobsExtended(
                page,
                20,          // limit
                search,
                sortField,
                sortOrder,
                filters
            );

            // Cast data.jobs to Job[] as the action might return a slightly different inferred type
            setJobs(data.jobs as any);
            setTotalPages(data.totalPages);
            setTotalCount(data.total);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'システム管理用求人一覧取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { page, search, statusFilter, prefectureFilter, serviceTypeFilter }
            });
            console.error(error);
            toast.error('求人の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [page, sortField, sortOrder]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchJobs();
    };

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('ALL');
        setStartDateFilter('');
        setEndDateFilter('');
        setPrefectureFilter('');
        setCityFilter('');
        setServiceTypeFilter('');
        setInterviewFilter('all');
        setQualificationFilter('');
        setPage(1);
        setTimeout(fetchJobs, 0);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleEdit = async (job: Job) => {
        if (!admin) return;
        try {
            // 施設管理者としてマスカレード
            const token = await generateMasqueradeToken(job.facilityId, admin.adminId || 1);
            // 編集画面へリダイレクト（正しいパス: /admin/masquerade）
            window.open(`/admin/masquerade?token=${token}&redirect=/admin/jobs/${job.id}/edit`, '_blank');
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'other',
                operation: 'マスカレードトークン生成(求人一覧)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: job.facilityId, jobId: job.id }
            });
            toast.error('編集画面を開けませんでした');
        }
    };

    const handleToggleRecruitmentClosed = async (job: Job) => {
        const newState = !job.isRecruitmentClosed;
        const action = newState ? '募集完了' : '募集再開';
        if (!confirm(`求人「${job.title}」を${action}にしますか？`)) return;
        try {
            await toggleJobRecruitmentClosed(job.id, newState);
            toast.success(`${action}にしました`);
            fetchJobs();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'other',
                operation: `求人${action}`,
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { jobId: job.id }
            });
            toast.error(`${action}に失敗しました`);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatMatchingPeriod = (hours: number | null) => {
        if (hours === null) return '-';
        if (hours < 1) return `${Math.round(hours * 60)}分`;
        return `${hours.toFixed(1)}時間`;
    };

    const cities = prefectureFilter ? getCitiesByPrefecture(prefectureFilter as Prefecture) : [];

    // Helper for sort icon
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
        return <ArrowUpDown className={`w-3 h-3 text-indigo-500 ml-1 inline ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Briefcase className="w-7 h-7 text-indigo-600" />
                        求人管理
                    </h1>
                    <p className="text-slate-500">登録求人の一覧・管理</p>
                </div>
                <div className="text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-lg">
                    全 <span className="font-bold text-slate-800">{totalCount}</span> 件
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 mb-6">
                <div className="flex flex-col gap-4">
                    <div className="flex gap-4">
                        <form onSubmit={handleSearch} className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ID、求人名、テンプレート名、施設名で検索"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </form>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Filter className="w-4 h-4" />
                            詳細フィルター
                        </button>
                    </div>

                    {showFilters && (
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* 1行目: ステータス、開始日、終了日、都道府県 */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">ステータス</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="ALL">すべて</option>
                                    {Object.entries(statusLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">開始日（作成日）</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={startDateFilter}
                                    onChange={(e) => setStartDateFilter(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">終了日（作成日）</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={endDateFilter}
                                    onChange={(e) => setEndDateFilter(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">都道府県</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={prefectureFilter}
                                    onChange={(e) => {
                                        setPrefectureFilter(e.target.value);
                                        setCityFilter('');
                                    }}
                                >
                                    <option value="">すべて</option>
                                    {PREFECTURES.map(pref => (
                                        <option key={pref} value={pref}>{pref}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2行目: 市区町村、審査、必要資格、サービス種別 */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">市区町村</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={cityFilter}
                                    onChange={(e) => setCityFilter(e.target.value)}
                                    disabled={!prefectureFilter}
                                >
                                    <option value="">すべて</option>
                                    {cities.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">審査</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={interviewFilter}
                                    onChange={(e) => setInterviewFilter(e.target.value as any)}
                                >
                                    <option value="all">すべて</option>
                                    <option value="true">審査あり</option>
                                    <option value="false">審査なし</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">必要資格</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={qualificationFilter}
                                    onChange={(e) => setQualificationFilter(e.target.value)}
                                >
                                    <option value="">すべて</option>
                                    {JOB_QUALIFICATION_OPTIONS.map(qual => (
                                        <option key={qual} value={qual}>{qual}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">サービス種別</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={serviceTypeFilter}
                                    onChange={(e) => setServiceTypeFilter(e.target.value)}
                                >
                                    <option value="">すべて</option>
                                    {SERVICE_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ボタン行 */}
                            <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700 hover:bg-slate-50 rounded-lg"
                                >
                                    リセット
                                </button>
                                <button
                                    onClick={() => { setPage(1); fetchJobs(); setShowFilters(false); }}
                                    className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                                >
                                    適用
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] overflow-x-auto relative">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-4 py-4 w-[250px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('created_at')}>
                                求人名 <SortIcon field="created_at" />
                            </th>
                            <th className="px-4 py-4 w-[200px]">
                                施設名
                            </th>
                            <th className="px-4 py-4 w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                ステータス <SortIcon field="status" />
                            </th>
                            <th className="px-4 py-4 w-[100px] text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('applicationSlots')}>
                                応募枠 <SortIcon field="applicationSlots" />
                            </th>
                            <th className="px-4 py-4 w-[100px] text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('applicationCount')}>
                                応募数 <SortIcon field="applicationCount" />
                            </th>
                            <th className="px-4 py-4 w-[120px] text-center">
                                作成日
                            </th>
                            <th className="px-4 py-4 w-[120px] text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('matchingPeriod')}>
                                マッチング <SortIcon field="matchingPeriod" />
                            </th>
                            <th className="px-4 py-4 w-[80px] text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                                    読み込み中...
                                </td>
                            </tr>
                        ) : jobs.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Briefcase className="w-12 h-12 text-slate-300" />
                                        <p>求人が見つかりません</p>
                                        {(search || statusFilter !== 'ALL' || startDateFilter || endDateFilter || prefectureFilter || cityFilter || serviceTypeFilter || interviewFilter !== 'all' || qualificationFilter) && (
                                            <button
                                                onClick={clearFilters}
                                                className="text-indigo-600 hover:underline text-sm"
                                            >
                                                フィルターをリセット
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <div className="font-bold text-slate-800 text-sm line-clamp-2">{job.title}</div>
                                            <div className="text-xs text-slate-400 mt-1">ID: {job.id}</div>
                                            {job.templateName && (
                                                <div className="text-xs text-slate-400 mt-0.5">Template: {job.templateName}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-slate-400" />
                                            <span className="text-sm text-slate-600 line-clamp-1">{job.facilityName}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 pl-5">{job.facilityType}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {statusLabels[job.status] || job.status}
                                        </span>
                                        {job.isRecruitmentClosed && (
                                            <div className="mt-1">
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">募集完了</span>
                                            </div>
                                        )}
                                        {job.requiresInterview && (
                                            <div className="mt-1">
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">審査あり</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center text-sm">
                                        {job.applicationSlots}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`text-sm font-medium ${job.applicationCount > 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                            {job.applicationCount}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center text-sm text-slate-600">
                                        {formatDate(job.createdAt)}
                                    </td>
                                    <td className="px-4 py-4 text-center text-sm text-slate-600">
                                        {formatMatchingPeriod(job.matchingPeriod)}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {/* 募集完了/再開トグル */}
                                            <button
                                                onClick={() => handleToggleRecruitmentClosed(job)}
                                                className={`p-1.5 rounded-lg transition-colors ${job.isRecruitmentClosed
                                                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                }`}
                                                title={job.isRecruitmentClosed ? '募集再開' : '募集完了にする'}
                                            >
                                                {job.isRecruitmentClosed ? <RotateCcw className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                            </button>
                                            {/* 閲覧アイコン */}
                                            <a
                                                href={`/jobs/${job.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="求人を見る"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </a>
                                            {/* 編集アイコン */}
                                            <button
                                                onClick={() => handleEdit(job)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="編集（マスカレード）"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-slate-500">
                    全 {totalCount} 件中 {(page - 1) * 20 + 1} - {Math.min(page * 20, totalCount)} 件を表示
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        前へ
                    </button>
                    <div className="flex items-center gap-1 px-2">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            // Simple pagination logic
                            let p = page;
                            if (totalPages <= 5) p = i + 1;
                            else if (page < 3) p = i + 1;
                            else if (page > totalPages - 2) p = totalPages - 4 + i;
                            else p = page - 2 + i;

                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-sm ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        次へ
                    </button>
                </div>
            </div>
        </div>
    );
}
