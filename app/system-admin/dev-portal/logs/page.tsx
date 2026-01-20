'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    Mail,
    MessageCircle,
    Bell,
    X,
    CheckCircle,
    AlertCircle,
    Bug,
    Activity,
    UserSearch,
    RefreshCw,
    AlertTriangle,
    Filter,
    Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// ========== 型定義 ==========

interface ActivityLog {
    id: number;
    user_type: 'WORKER' | 'FACILITY' | 'GUEST';
    user_id: number | null;
    user_email: string | null;
    action: string;
    target_type: string | null;
    target_id: number | null;
    request_data: Record<string, unknown> | null;
    response_data: Record<string, unknown> | null;
    result: 'SUCCESS' | 'ERROR';
    error_message: string | null;
    error_stack: string | null;
    url: string | null;
    user_agent: string | null;
    ip_address: string | null;
    created_at: string;
}

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

type TabType = 'errors' | 'activity' | 'notifications' | 'trace';

// ========== メインコンポーネント ==========

export default function LogViewerPage() {
    const { showDebugError } = useDebugError();
    const [activeTab, setActiveTab] = useState<TabType>('errors');

    // 操作ログ状態
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityPage, setActivityPage] = useState(1);
    const [activityTotalPages, setActivityTotalPages] = useState(1);
    const [activityTotal, setActivityTotal] = useState(0);
    const [errorCount24h, setErrorCount24h] = useState(0);
    const [availableActions, setAvailableActions] = useState<string[]>([]);

    // 通知ログ状態
    const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
    const [notificationLoading, setNotificationLoading] = useState(true);
    const [notificationPage, setNotificationPage] = useState(1);
    const [notificationTotalPages, setNotificationTotalPages] = useState(1);
    const [notificationTotal, setNotificationTotal] = useState(0);

    // フィルタ状態
    const [userTypeFilter, setUserTypeFilter] = useState('ALL');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [notificationChannel, setNotificationChannel] = useState('ALL');
    const [notificationTargetType, setNotificationTargetType] = useState('WORKER');

    // ユーザー追跡用
    const [traceUserId, setTraceUserId] = useState('');
    const [traceUserType, setTraceUserType] = useState('WORKER');

    // 詳細モーダル
    const [selectedActivityLog, setSelectedActivityLog] = useState<ActivityLog | null>(null);
    const [selectedNotificationLog, setSelectedNotificationLog] = useState<NotificationLog | null>(null);

    // ========== データ取得 ==========

    const fetchActivityLogs = useCallback(async (errorsOnly: boolean = false, userId?: string) => {
        setActivityLoading(true);
        try {
            const params = new URLSearchParams({
                page: activityPage.toString(),
                limit: '20',
            });

            if (errorsOnly) {
                params.append('errors_only', 'true');
            } else {
                if (userTypeFilter !== 'ALL') params.append('user_type', userTypeFilter);
                if (actionFilter !== 'ALL') params.append('action', actionFilter);
            }

            if (userId) {
                params.append('user_id', userId);
                params.append('user_type', traceUserType);
            }

            if (searchQuery) params.append('search', searchQuery);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);

            const res = await fetch(`/api/system-admin/activity-logs?${params}`);
            const data = await res.json();

            setActivityLogs(data.logs || []);
            setActivityTotalPages(data.totalPages || 1);
            setActivityTotal(data.total || 0);
            setErrorCount24h(data.errorCount24h || 0);
            setAvailableActions(data.availableActions || []);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: '操作ログ取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
            });
            toast.error('ログの取得に失敗しました');
        } finally {
            setActivityLoading(false);
        }
    }, [activityPage, userTypeFilter, actionFilter, searchQuery, dateFrom, dateTo, traceUserType, showDebugError]);

    const fetchNotificationLogs = useCallback(async () => {
        setNotificationLoading(true);
        try {
            const params = new URLSearchParams({
                page: notificationPage.toString(),
                limit: '20',
                target_type: notificationTargetType,
            });

            if (notificationChannel !== 'ALL') params.append('channel', notificationChannel);
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`/api/system-admin/notification-logs?${params}`);
            const data = await res.json();

            setNotificationLogs(data.logs || []);
            setNotificationTotalPages(data.totalPages || 1);
            setNotificationTotal(data.total || 0);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: '通知ログ取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
            });
            toast.error('ログの取得に失敗しました');
        } finally {
            setNotificationLoading(false);
        }
    }, [notificationPage, notificationTargetType, notificationChannel, searchQuery, showDebugError]);

    // タブ切り替え時のデータ取得
    useEffect(() => {
        if (activeTab === 'errors') {
            fetchActivityLogs(true);
        } else if (activeTab === 'activity') {
            fetchActivityLogs(false);
        } else if (activeTab === 'notifications') {
            fetchNotificationLogs();
        } else if (activeTab === 'trace' && traceUserId) {
            fetchActivityLogs(false, traceUserId);
        }
    }, [activeTab, activityPage, notificationPage, fetchActivityLogs, fetchNotificationLogs, traceUserId]);

    // ========== ヘルパー関数 ==========

    const getUserTypeBadge = (userType: string) => {
        const styles: Record<string, string> = {
            WORKER: 'bg-blue-50 text-blue-700',
            FACILITY: 'bg-green-50 text-green-700',
            GUEST: 'bg-gray-50 text-gray-700',
        };
        const labels: Record<string, string> = {
            WORKER: 'ワーカー',
            FACILITY: '施設',
            GUEST: 'ゲスト',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[userType] || styles.GUEST}`}>
                {labels[userType] || userType}
            </span>
        );
    };

    const getResultBadge = (result: string) => {
        if (result === 'SUCCESS') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    成功
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                <AlertCircle className="w-3 h-3" />
                エラー
            </span>
        );
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'CHAT': return <MessageCircle className="w-4 h-4 text-blue-500" />;
            case 'EMAIL': return <Mail className="w-4 h-4 text-orange-500" />;
            case 'PUSH': return <Bell className="w-4 h-4 text-purple-500" />;
            default: return null;
        }
    };

    const handleTraceUser = (log: ActivityLog) => {
        if (log.user_id) {
            setTraceUserId(log.user_id.toString());
            setTraceUserType(log.user_type);
            setActiveTab('trace');
            setActivityPage(1);
        }
    };

    // ========== レンダリング ==========

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'errors', label: 'エラー一覧', icon: <Bug className="w-4 h-4" /> },
        { id: 'activity', label: '全操作ログ', icon: <Activity className="w-4 h-4" /> },
        { id: 'notifications', label: '通知ログ', icon: <Bell className="w-4 h-4" /> },
        { id: 'trace', label: 'ユーザー追跡', icon: <UserSearch className="w-4 h-4" /> },
    ];

    return (
        <div className="p-8">
            {/* ヘッダー */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Bug className="w-6 h-6 text-red-500" />
                    バグ調査ダッシュボード
                </h1>
                <p className="text-slate-500">ユーザー操作ログからバグを早期発見・調査</p>
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">直近24時間のエラー</p>
                            <p className="text-2xl font-bold text-red-600">{errorCount24h}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">操作ログ総数</p>
                            <p className="text-2xl font-bold text-slate-800">{activityTotal.toLocaleString()}</p>
                        </div>
                        <Activity className="w-8 h-8 text-slate-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">通知ログ総数</p>
                            <p className="text-2xl font-bold text-slate-800">{notificationTotal.toLocaleString()}</p>
                        </div>
                        <Bell className="w-8 h-8 text-slate-200" />
                    </div>
                </div>
            </div>

            {/* タブ */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setActivityPage(1);
                                    setNotificationPage(1);
                                }}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.id === 'errors' && errorCount24h > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">
                                        {errorCount24h}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* フィルタエリア */}
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* エラー一覧・全操作ログ共通フィルタ */}
                        {(activeTab === 'errors' || activeTab === 'activity') && (
                            <>
                                {activeTab === 'activity' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">ユーザー種別</label>
                                            <select
                                                value={userTypeFilter}
                                                onChange={(e) => { setUserTypeFilter(e.target.value); setActivityPage(1); }}
                                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="ALL">すべて</option>
                                                <option value="WORKER">ワーカー</option>
                                                <option value="FACILITY">施設</option>
                                                <option value="GUEST">ゲスト</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">アクション</label>
                                            <select
                                                value={actionFilter}
                                                onChange={(e) => { setActionFilter(e.target.value); setActivityPage(1); }}
                                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="ALL">すべて</option>
                                                {availableActions.map(action => (
                                                    <option key={action} value={action}>{action}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        開始日
                                    </label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => { setDateFrom(e.target.value); setActivityPage(1); }}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        終了日
                                    </label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => { setDateTo(e.target.value); setActivityPage(1); }}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </>
                        )}

                        {/* 通知ログ専用フィルタ */}
                        {activeTab === 'notifications' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">対象</label>
                                    <select
                                        value={notificationTargetType}
                                        onChange={(e) => { setNotificationTargetType(e.target.value); setNotificationPage(1); }}
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
                                        value={notificationChannel}
                                        onChange={(e) => { setNotificationChannel(e.target.value); setNotificationPage(1); }}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="ALL">すべて</option>
                                        <option value="CHAT">チャット</option>
                                        <option value="EMAIL">メール</option>
                                        <option value="PUSH">プッシュ</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* ユーザー追跡専用入力 */}
                        {activeTab === 'trace' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">ユーザー種別</label>
                                    <select
                                        value={traceUserType}
                                        onChange={(e) => setTraceUserType(e.target.value)}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="WORKER">ワーカー</option>
                                        <option value="FACILITY">施設</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">ユーザーID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={traceUserId}
                                            onChange={(e) => setTraceUserId(e.target.value)}
                                            placeholder="ユーザーIDを入力..."
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            onClick={() => { setActivityPage(1); fetchActivityLogs(false, traceUserId); }}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                        >
                                            <Search className="w-4 h-4" />
                                            追跡
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* リロードボタン */}
                        <button
                            onClick={() => {
                                if (activeTab === 'notifications') {
                                    fetchNotificationLogs();
                                } else if (activeTab === 'trace') {
                                    fetchActivityLogs(false, traceUserId);
                                } else {
                                    fetchActivityLogs(activeTab === 'errors');
                                }
                            }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            更新
                        </button>
                    </div>
                </div>

                {/* テーブル: 操作ログ */}
                {(activeTab === 'errors' || activeTab === 'activity' || activeTab === 'trace') && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-slate-500">日時</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">種別</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">アクション</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">ユーザー</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">結果</th>
                                    <th className="px-6 py-3 text-right font-medium text-slate-500">詳細</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {activityLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                                            <p>読み込み中...</p>
                                        </td>
                                    </tr>
                                ) : activityLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            {activeTab === 'trace' && !traceUserId
                                                ? 'ユーザーIDを入力して追跡を開始してください'
                                                : 'ログが見つかりませんでした'}
                                        </td>
                                    </tr>
                                ) : (
                                    activityLogs.map(log => (
                                        <tr key={log.id} className={`hover:bg-slate-50/50 ${log.result === 'ERROR' ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                                {format(new Date(log.created_at), 'MM/dd HH:mm:ss', { locale: ja })}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getUserTypeBadge(log.user_type)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-mono">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-800 font-medium">ID: {log.user_id || '-'}</div>
                                                <div className="text-slate-500 text-xs">{log.user_email || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getResultBadge(log.result)}
                                                {log.error_message && (
                                                    <div className="text-xs text-red-600 mt-1 truncate max-w-[200px]" title={log.error_message}>
                                                        {log.error_message}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {log.user_id && activeTab !== 'trace' && (
                                                        <button
                                                            onClick={() => handleTraceUser(log)}
                                                            className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                                            title="このユーザーを追跡"
                                                        >
                                                            <UserSearch className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedActivityLog(log)}
                                                        className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* ページネーション */}
                        {!activityLoading && activityLogs.length > 0 && (
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    全 {activityTotal} 件中 {(activityPage - 1) * 20 + 1} 〜 {Math.min(activityPage * 20, activityTotal)} 件を表示
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                                        disabled={activityPage === 1}
                                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="flex items-center px-4 text-sm font-medium text-slate-700">
                                        Page {activityPage} / {activityTotalPages || 1}
                                    </span>
                                    <button
                                        onClick={() => setActivityPage(p => Math.min(activityTotalPages, p + 1))}
                                        disabled={activityPage >= activityTotalPages}
                                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* テーブル: 通知ログ */}
                {activeTab === 'notifications' && (
                    <div className="overflow-x-auto">
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
                                {notificationLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                                            <p>読み込み中...</p>
                                        </td>
                                    </tr>
                                ) : notificationLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            ログが見つかりませんでした
                                        </td>
                                    </tr>
                                ) : (
                                    notificationLogs.map(log => (
                                        <tr key={log.id} className={`hover:bg-slate-50/50 ${log.status === 'FAILED' ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                                {format(new Date(log.created_at), 'MM/dd HH:mm', { locale: ja })}
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
                                                {log.status === 'SENT' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                                        <CheckCircle className="w-3 h-3" />
                                                        送信済
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                                                        <AlertCircle className="w-3 h-3" />
                                                        失敗
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedNotificationLog(log)}
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
                        {!notificationLoading && notificationLogs.length > 0 && (
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    全 {notificationTotal} 件中 {(notificationPage - 1) * 20 + 1} 〜 {Math.min(notificationPage * 20, notificationTotal)} 件を表示
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNotificationPage(p => Math.max(1, p - 1))}
                                        disabled={notificationPage === 1}
                                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="flex items-center px-4 text-sm font-medium text-slate-700">
                                        Page {notificationPage} / {notificationTotalPages || 1}
                                    </span>
                                    <button
                                        onClick={() => setNotificationPage(p => Math.min(notificationTotalPages, p + 1))}
                                        disabled={notificationPage >= notificationTotalPages}
                                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 操作ログ詳細モーダル */}
            {selectedActivityLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-lg font-bold text-slate-800">操作ログ詳細</h2>
                            <button
                                onClick={() => setSelectedActivityLog(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 基本情報 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500">日時</label>
                                    <p className="text-sm text-slate-800">
                                        {format(new Date(selectedActivityLog.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">結果</label>
                                    <div className="mt-1">{getResultBadge(selectedActivityLog.result)}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">ユーザー種別</label>
                                    <div className="mt-1">{getUserTypeBadge(selectedActivityLog.user_type)}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">ユーザーID</label>
                                    <p className="text-sm text-slate-800">{selectedActivityLog.user_id || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">メールアドレス</label>
                                    <p className="text-sm text-slate-800">{selectedActivityLog.user_email || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">アクション</label>
                                    <p className="text-sm font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded inline-block">
                                        {selectedActivityLog.action}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">対象タイプ</label>
                                    <p className="text-sm text-slate-800">{selectedActivityLog.target_type || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">対象ID</label>
                                    <p className="text-sm text-slate-800">{selectedActivityLog.target_id || '-'}</p>
                                </div>
                            </div>

                            {/* エラー情報 */}
                            {selectedActivityLog.result === 'ERROR' && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        エラー情報
                                    </h3>
                                    {selectedActivityLog.error_message && (
                                        <div className="mb-2">
                                            <label className="text-xs font-medium text-red-600">エラーメッセージ</label>
                                            <p className="text-sm text-red-800 mt-1">{selectedActivityLog.error_message}</p>
                                        </div>
                                    )}
                                    {selectedActivityLog.error_stack && (
                                        <div>
                                            <label className="text-xs font-medium text-red-600">スタックトレース</label>
                                            <pre className="text-xs text-red-700 mt-1 bg-red-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                                {selectedActivityLog.error_stack}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* リクエストデータ */}
                            {selectedActivityLog.request_data && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 mb-2">リクエストデータ</h3>
                                    <pre className="bg-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto text-slate-700">
                                        {JSON.stringify(selectedActivityLog.request_data, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* レスポンスデータ */}
                            {selectedActivityLog.response_data && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 mb-2">レスポンスデータ</h3>
                                    <pre className="bg-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto text-slate-700">
                                        {JSON.stringify(selectedActivityLog.response_data, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* コンテキスト情報 */}
                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3">コンテキスト</h3>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div className="flex">
                                        <span className="text-slate-500 w-24">URL:</span>
                                        <span className="text-slate-700 font-mono text-xs">{selectedActivityLog.url || '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-slate-500 w-24">IP:</span>
                                        <span className="text-slate-700">{selectedActivityLog.ip_address || '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="text-slate-500 w-24">User Agent:</span>
                                        <span className="text-slate-700 text-xs truncate">{selectedActivityLog.user_agent || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
                            {selectedActivityLog.user_id && (
                                <button
                                    onClick={() => {
                                        handleTraceUser(selectedActivityLog);
                                        setSelectedActivityLog(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <UserSearch className="w-4 h-4" />
                                    このユーザーを追跡
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedActivityLog(null)}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 通知ログ詳細モーダル */}
            {selectedNotificationLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-lg font-bold text-slate-800">通知ログ詳細</h2>
                            <button
                                onClick={() => setSelectedNotificationLog(null)}
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
                                        {format(new Date(selectedNotificationLog.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">ステータス</label>
                                    <div className="mt-1">
                                        {selectedNotificationLog.status === 'SENT' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                                <CheckCircle className="w-3 h-3" />
                                                送信済
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                                                <AlertCircle className="w-3 h-3" />
                                                失敗
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">宛先名</label>
                                    <p className="text-sm text-slate-800">{selectedNotificationLog.recipient_name || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500">宛先メール</label>
                                    <p className="text-sm text-slate-800">{selectedNotificationLog.recipient_email || '-'}</p>
                                </div>
                            </div>

                            {selectedNotificationLog.error_message && (
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                                    <p className="font-bold mb-1">エラー内容:</p>
                                    {selectedNotificationLog.error_message}
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    {getChannelIcon(selectedNotificationLog.channel)}
                                    送信コンテンツ
                                </h3>

                                <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                                    {selectedNotificationLog.channel === 'EMAIL' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">件名</label>
                                                <p className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                                                    {selectedNotificationLog.subject}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">本文</label>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                                                    {selectedNotificationLog.body}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {selectedNotificationLog.channel === 'CHAT' && (
                                        <div>
                                            <label className="text-xs font-medium text-slate-500">メッセージ</label>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                {selectedNotificationLog.chat_message}
                                            </p>
                                        </div>
                                    )}

                                    {selectedNotificationLog.channel === 'PUSH' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">タイトル</label>
                                                <p className="text-sm font-semibold text-slate-900 mb-1">
                                                    {selectedNotificationLog.push_title}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">本文</label>
                                                <p className="text-sm text-slate-700">
                                                    {selectedNotificationLog.push_body}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setSelectedNotificationLog(null)}
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
