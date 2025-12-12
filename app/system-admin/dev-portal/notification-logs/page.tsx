'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Eye,
    Mail,
    MessageCircle,
    Bell,
    X,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface NotificationLog {
    id: number;
    notification_key: string;
    channel: 'CHAT' | 'EMAIL' | 'PUSH';
    target_type: 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN';
    recipient_name: string | null;
    recipient_email: string | null;
    subject: string | null;
    body: string | null;
    chat_message: string | null;
    push_title: string | null;
    push_body: string | null;
    status: 'SENT' | 'FAILED';
    error_message: string | null;
    created_at: string;
}

export default function NotificationLogsPage() {
    const [logs, setLogs] = useState<NotificationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    // フィルタ状態
    const [page, setPage] = useState(1);
    const [targetType, setTargetType] = useState('WORKER');
    const [channel, setChannel] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [page, targetType, channel]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                target_type: targetType,
            });

            if (channel !== 'ALL') params.append('channel', channel);
            if (search) params.append('search', search);

            const res = await fetch(`/api/system-admin/notification-logs?${params}`);
            const data = await res.json();

            setLogs(data.logs);
            setTotalPages(data.totalPages);
            setTotalLogs(data.total);
        } catch (error) {
            toast.error('ログの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'CHAT': return <MessageCircle className="w-4 h-4 text-blue-500" />;
            case 'EMAIL': return <Mail className="w-4 h-4 text-orange-500" />;
            case 'PUSH': return <Bell className="w-4 h-4 text-purple-500" />;
            default: return null;
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'SENT') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    送信済
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                <AlertCircle className="w-3 h-3" />
                失敗
            </span>
        );
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">通知ログ</h1>
                <p className="text-slate-500">送信された通知の履歴を確認できます</p>
            </div>

            {/* フィルタエリア */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">対象</label>
                        <select
                            value={targetType}
                            onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="WORKER">ワーカー</option>
                            <option value="FACILITY">施設</option>
                            <option value="SYSTEM_ADMIN">システム管理者</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">チャンネル</label>
                        <select
                            value={channel}
                            onChange={(e) => { setChannel(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">すべて</option>
                            <option value="CHAT">チャット</option>
                            <option value="EMAIL">メール</option>
                            <option value="PUSH">プッシュ</option>
                        </select>
                    </div>

                    <form onSubmit={handleSearch} className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">検索（名前・メール）</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="ユーザー名やメールアドレスで検索..."
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <Search className="w-4 h-4" />
                                検索
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ログ一覧 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500">日時</th>
                            <th className="px-6 py-3 font-medium text-slate-500">チャンネル</th>
                            <th className="px-6 py-3 font-medium text-slate-500">通知タイプ</th>
                            <th className="px-6 py-3 font-medium text-slate-500">宛先</th>
                            <th className="px-6 py-3 font-medium text-slate-500">ステータス</th>
                            <th className="px-6 py-3 text-right font-medium text-slate-500">詳細</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                                    <p>読み込み中...</p>
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    ログが見つかりませんでした
                                </td>
                            </tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                        {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getChannelIcon(log.channel)}
                                            <span className="text-slate-700">{log.channel}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">
                                            {log.notification_key}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-800 font-medium">{log.recipient_name}</div>
                                        <div className="text-slate-500 text-xs">{log.recipient_email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(log.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* ページネーション */}
                {!loading && logs.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            全 {totalLogs} 件中 {(page - 1) * 20 + 1} 〜 {Math.min(page * 20, totalLogs)} 件を表示
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="flex items-center px-4 text-sm font-medium text-slate-700">
                                Page {page} / {totalPages || 1}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 詳細モーダル */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-lg font-bold text-slate-800">ログ詳細</h2>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500">日時</label>
                                    <p className="text-sm text-slate-800">
                                        {format(new Date(selectedLog.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">ステータス</label>
                                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">宛先名</label>
                                    <p className="text-sm text-slate-800">{selectedLog.recipient_name || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">宛先メール</label>
                                    <p className="text-sm text-slate-800">{selectedLog.recipient_email || '-'}</p>
                                </div>
                            </div>

                            {selectedLog.error_message && (
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                                    <p className="font-bold mb-1">エラー内容:</p>
                                    {selectedLog.error_message}
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    {getChannelIcon(selectedLog.channel)}
                                    送信コンテンツ
                                </h3>

                                <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                                    {selectedLog.channel === 'EMAIL' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">件名</label>
                                                <p className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                                                    {selectedLog.subject}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">本文</label>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                                                    {selectedLog.body}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {selectedLog.channel === 'CHAT' && (
                                        <div>
                                            <label className="text-xs font-medium text-slate-500">メッセージ</label>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                {selectedLog.chat_message}
                                            </p>
                                        </div>
                                    )}

                                    {selectedLog.channel === 'PUSH' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">タイトル</label>
                                                <p className="text-sm font-semibold text-slate-900 mb-1">
                                                    {selectedLog.push_title}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">本文</label>
                                                <p className="text-sm text-slate-700">
                                                    {selectedLog.push_body}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
