'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    getSystemJobsExtended,
    forceStopJob,
    forceResumeJob,
    forceDeleteJob,
    generateMasqueradeToken
} from '@/src/lib/system-actions';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import {
    Search,
    Filter,
    Eye,
    Edit,
    Trash2,
    MoreVertical,
    ChevronDown,
    X,
    ArrowUpDown,
    Briefcase,
    StopCircle,
    PlayCircle,
    Calendar,
    Clock,
    RefreshCw,
    Building2,
    CheckCircle,
    AlertCircle,
    FileText
} from 'lucide-react';
import { PREFECTURES, FACILITY_TYPES } from '@/constants/job';
import { getCitiesByPrefecture, Prefecture } from '@/constants/prefectureCities';
import toast from 'react-hot-toast';

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
    const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
    const [interviewFilter, setInterviewFilter] = useState<'all' | 'true' | 'false'>('all');

    // Sort
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Action Menu
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const filters = {
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                startDate: startDateFilter || undefined,
                endDate: endDateFilter || undefined,
                prefecture: prefectureFilter || undefined,
                city: cityFilter || undefined,
                facilityType: facilityTypeFilter || undefined,
                requiresInterview: interviewFilter === 'all' ? undefined : interviewFilter === 'true',
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
            console.error(error);
            toast.error('求人の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [page, sortField, sortOrder]);

    // メニュー外クリックで閉じる
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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
        setFacilityTypeFilter('');
        setInterviewFilter('all');
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
            // 編集画面へリダイレクト
            window.open(`/masquerade?token=${token}&redirect=/admin/jobs/${job.id}/edit`, '_blank');
        } catch (error) {
            toast.error('編集画面を開けませんでした');
        }
    };

    const handleStop = async (job: Job) => {
        if (confirm(`求人「${job.title}」を停止しますか？`)) {
            const result = await forceStopJob(job.id);
            if (result.success) {
                toast.success('求人を停止しました');
                fetchJobs();
            } else {
                toast.error('停止に失敗しました');
            }
        }
    };

    const handleResume = async (job: Job) => {
        if (confirm(`求人「${job.title}」の停止を解除しますか？`)) {
            const result = await forceResumeJob(job.id);
            if (result.success) {
                toast.success('停止を解除しました');
                fetchJobs();
            } else {
                toast.error('解除に失敗しました');
            }
        }
    };

    const handleDelete = async (job: Job) => {
        if (confirm(`求人「${job.title}」を削除しますか？\nこの操作は取り消せません。`)) {
            const result = await forceDeleteJob(job.id);
            if (result.success) {
                toast.success('求人を削除しました');
                fetchJobs();
            } else {
                toast.error('削除に失敗しました');
            }
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
                                <label className="block text-xs font-medium text-slate-500 mb-1">施設種別</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={facilityTypeFilter}
                                    onChange={(e) => setFacilityTypeFilter(e.target.value)}
                                >
                                    <option value="">すべて</option>
                                    {FACILITY_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
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
                                <label className="block text-xs font-medium text-slate-500 mb-1">面接</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={interviewFilter}
                                    onChange={(e) => setInterviewFilter(e.target.value as any)}
                                >
                                    <option value="all">すべて</option>
                                    <option value="true">面接あり</option>
                                    <option value="false">面接なし</option>
                                </select>
                            </div>

                            <div className="md:col-span-1 flex items-end justify-end gap-2">
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
                                    求人が見つかりません
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
                                        {job.requiresInterview && (
                                            <div className="mt-1">
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">面接あり</span>
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
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === job.id ? null : job.id);
                                                }}
                                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openMenuId === job.id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 z-10 overflow-hidden">
                                                    <a
                                                        href={`/jobs/${job.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                        onClick={() => setOpenMenuId(null)}
                                                    >
                                                        <Eye className="w-4 h-4 text-slate-400" />
                                                        求人を見る
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            handleEdit(job);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                    >
                                                        <Edit className="w-4 h-4 text-slate-400" />
                                                        編集 (マスカレード)
                                                    </button>

                                                    {job.status === 'PUBLISHED' && (
                                                        <button
                                                            onClick={() => {
                                                                handleStop(job);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors text-left border-t border-slate-50"
                                                        >
                                                            <StopCircle className="w-4 h-4" />
                                                            募集停止
                                                        </button>
                                                    )}

                                                    {job.status === 'STOPPED' && (
                                                        <button
                                                            onClick={() => {
                                                                handleResume(job);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition-colors text-left border-t border-slate-50"
                                                        >
                                                            <PlayCircle className="w-4 h-4" />
                                                            募集再開
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            handleDelete(job);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-slate-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        削除
                                                    </button>
                                                </div>
                                            )}
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
