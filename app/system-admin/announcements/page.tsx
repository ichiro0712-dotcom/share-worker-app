'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSystemAnnouncements, deleteAnnouncement } from '@/src/lib/system-actions';
import { Search, Filter, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { useRouter } from 'next/navigation';

interface Announcement {
    id: number;
    title: string;
    category: string;
    target_type: string;
    published: boolean;
    published_at: Date | null;
    created_at: Date;
}

export default function SystemAdminAnnouncementsPage() {
    const { showDebugError } = useDebugError();
    const router = useRouter();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [targetType, setTargetType] = useState('ALL');
    const [status, setStatus] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const data = await getSystemAnnouncements(page, 20, search, targetType, status);
            setAnnouncements(data.announcements);
            setTotalPages(data.totalPages);
            setTotalCount(data.total);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'システムお知らせ一覧取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { page, search, targetType, status }
            });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, [page, search, targetType, status]);

    const handleDelete = async (id: number) => {
        if (!confirm('本当にこのお知らせを削除しますか？')) return;
        try {
            const result = await deleteAnnouncement(id);
            if (result.success) {
                toast.success('お知らせを削除しました');
                fetchAnnouncements();
            } else {
                toast.error('削除に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'delete',
                operation: 'システムお知らせ削除',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { id }
            });
            toast.error('エラーが発生しました');
        }
    };

    const getTargetLabel = (type: string) => {
        switch (type) {
            case 'ALL': return '全員';
            case 'WORKER': return 'ワーカー';
            case 'FACILITY': return '施設';
            default: return type;
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'NEWS': return 'ニュース';
            case 'MAINTENANCE': return 'メンテナンス';
            case 'EVENT': return 'イベント';
            case 'IMPORTANT': return '重要';
            default: return category;
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">お知らせ管理</h1>
                    <p className="text-slate-500">お知らせの作成・編集・配信</p>
                </div>
                <Link
                    href="/system-admin/announcements/create"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    新規作成
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex-1 relative min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="タイトル、本文で検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                </div>

                <select
                    value={targetType}
                    onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                    <option value="ALL">全ての配信先</option>
                    <option value="WORKER">ワーカーのみ</option>
                    <option value="FACILITY">施設のみ</option>
                </select>

                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                    <option value="">全てのステータス</option>
                    <option value="PUBLISHED">公開中</option>
                    <option value="DRAFT">下書き</option>
                </select>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">ステータス</th>
                            <th className="px-6 py-4">タイトル</th>
                            <th className="px-6 py-4">カテゴリー</th>
                            <th className="px-6 py-4">配信先</th>
                            <th className="px-6 py-4">公開日時</th>
                            <th className="px-6 py-4 text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    読み込み中...
                                </td>
                            </tr>
                        ) : announcements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    お知らせが見つかりません
                                </td>
                            </tr>
                        ) : (
                            announcements.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {item.published ? (
                                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">公開中</span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">下書き</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {item.title}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {getCategoryLabel(item.category)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {getTargetLabel(item.target_type)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {item.published_at ? format(new Date(item.published_at), 'yyyy/MM/dd HH:mm') : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/system-admin/announcements/${item.id}`}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
            <div className="flex justify-center mt-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                    >
                        前へ
                    </button>
                    <span className="px-3 py-1 text-slate-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                    >
                        次へ
                    </button>
                </div>
            </div>
        </div>
    );
}
