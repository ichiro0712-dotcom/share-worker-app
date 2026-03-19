'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
    Shield,
    Search,
    ChevronLeft,
    ChevronRight,
    Filter,
    Calendar,
    Eye,
    X,
    RefreshCw,
    UserCog,
    HelpCircle,
    CheckCircle,
    AlertTriangle,
} from 'lucide-react';

interface SystemLog {
    id: number;
    admin_id: number;
    action: string;
    target_type: string;
    target_id: number | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
    admin_name: string;
    admin_email: string | null;
}

interface AdminOption {
    id: number;
    name: string;
}

// アクション名の日本語マッピング
const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'ログイン',
    LOGOUT: 'ログアウト',
    CREATE_SYSTEM_ADMIN: '管理者作成',
    DELETE_SYSTEM_ADMIN: '管理者削除',
    UPDATE_SYSTEM_ADMIN_NAME: '管理者名変更',
    UPDATE_SYSTEM_ADMIN_ROLE: '権限変更',
    UPDATE_SYSTEM_ADMIN_NOTIFICATION_EMAIL: '通知メール変更',
    UPDATE_USER: 'ユーザー更新',
    DELETE_USER: 'ユーザー削除',
    UPDATE_FACILITY: '施設更新',
    DELETE_FACILITY: '施設削除',
    UPDATE_JOB: '求人更新',
    DELETE_JOB: '求人削除',
    FORCE_STOP_JOB: '求人強制停止',
    UPDATE_APPLICATION: '応募更新',
    UPDATE_ATTENDANCE: '勤怠更新',
    MASQUERADE_LOGIN: 'なりすましログイン',
    UPDATE_SYSTEM_SETTING: 'システム設定変更',
    PASSWORD_RESET: 'パスワードリセット',
};

// ヘルプ用：取得対象の操作一覧
const LOG_CATEGORIES = [
    {
        category: '認証',
        tracked: true,
        items: [
            { action: 'LOGIN', label: 'ログイン', description: 'システム管理画面へのログイン' },
            { action: 'LOGOUT', label: 'ログアウト', description: 'システム管理画面からのログアウト' },
            { action: 'MASQUERADE_LOGIN', label: 'なりすましログイン', description: '施設管理者としてのなりすましログイン' },
        ],
    },
    {
        category: '管理者アカウント',
        tracked: true,
        items: [
            { action: 'CREATE_SYSTEM_ADMIN', label: '管理者作成', description: '新しいシステム管理者アカウントの作成' },
            { action: 'DELETE_SYSTEM_ADMIN', label: '管理者削除', description: 'システム管理者アカウントの削除' },
            { action: 'UPDATE_SYSTEM_ADMIN_NAME', label: '管理者名変更', description: '管理者の表示名を変更' },
            { action: 'UPDATE_SYSTEM_ADMIN_ROLE', label: '権限変更', description: 'admin / super_admin 権限の変更' },
            { action: 'UPDATE_SYSTEM_ADMIN_NOTIFICATION_EMAIL', label: '通知メール変更', description: '通知先メールアドレスの変更' },
            { action: 'PASSWORD_RESET', label: 'パスワードリセット', description: '管理者パスワードのリセット' },
        ],
    },
    {
        category: '勤怠管理',
        tracked: true,
        items: [
            { action: 'UPDATE_ATTENDANCE', label: '勤怠更新', description: '勤怠時間・給与・ステータスの編集（変更前後の値を記録）' },
        ],
    },
    {
        category: '求人管理',
        tracked: true,
        items: [
            { action: 'FORCE_STOP_JOB', label: '求人強制停止', description: '公開中の求人を強制的に停止' },
        ],
    },
    {
        category: 'システム設定',
        tracked: true,
        items: [
            { action: 'UPDATE_SYSTEM_SETTING', label: 'システム設定変更', description: 'システム全体の設定値の変更' },
        ],
    },
    {
        category: '最低賃金管理',
        tracked: false,
        items: [
            { action: '-', label: '最低賃金の更新・インポート・削除', description: '今後対応予定' },
        ],
    },
    {
        category: 'LP管理',
        tracked: false,
        items: [
            { action: '-', label: 'LP作成・削除・更新', description: '今後対応予定' },
        ],
    },
];

// アクションのカテゴリ色
function getActionColor(action: string): string {
    if (action.includes('DELETE') || action === 'FORCE_STOP_JOB') return 'bg-red-100 text-red-700';
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700';
    if (action.includes('UPDATE') || action.includes('RESET')) return 'bg-blue-100 text-blue-700';
    if (action === 'LOGIN' || action === 'LOGOUT') return 'bg-slate-100 text-slate-700';
    if (action === 'MASQUERADE_LOGIN') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // フィルタ
    const [selectedAdmin, setSelectedAdmin] = useState('');
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedTargetType, setSelectedTargetType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // フィルタ選択肢
    const [availableAdmins, setAvailableAdmins] = useState<AdminOption[]>([]);
    const [availableActions, setAvailableActions] = useState<string[]>([]);
    const [availableTargetTypes, setAvailableTargetTypes] = useState<string[]>([]);

    // 詳細モーダル
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

    // ヘルプモーダル
    const [showHelp, setShowHelp] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '30' });
            if (selectedAdmin) params.set('admin_id', selectedAdmin);
            if (selectedAction) params.set('action', selectedAction);
            if (selectedTargetType) params.set('target_type', selectedTargetType);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);

            const res = await fetch(`/api/system-admin/system-logs?${params}`);
            if (!res.ok) throw new Error('取得に失敗しました');
            const data = await res.json();

            setLogs(data.logs);
            setTotalPages(data.totalPages);
            setTotal(data.total);
            if (data.availableAdmins) setAvailableAdmins(data.availableAdmins);
            if (data.availableActions) setAvailableActions(data.availableActions);
            if (data.availableTargetTypes) setAvailableTargetTypes(data.availableTargetTypes);
        } catch {
            console.error('Failed to fetch admin logs');
        } finally {
            setLoading(false);
        }
    }, [page, selectedAdmin, selectedAction, selectedTargetType, dateFrom, dateTo]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const resetFilters = () => {
        setSelectedAdmin('');
        setSelectedAction('');
        setSelectedTargetType('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const hasFilters = selectedAdmin || selectedAction || selectedTargetType || dateFrom || dateTo;

    const formatDate = (dateStr: string) => {
        const jstDate = toZonedTime(new Date(dateStr), 'Asia/Tokyo');
        return format(jstDate, 'yyyy/MM/dd HH:mm:ss');
    };

    return (
        <div className="p-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <UserCog className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">管理者操作ログ</h1>
                        <p className="text-sm text-gray-500">システム管理者の操作履歴（{total.toLocaleString()}件）</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHelp(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                        取得対象
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        更新
                    </button>
                </div>
            </div>

            {/* フィルタ */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">フィルタ</span>
                    {hasFilters && (
                        <button
                            onClick={resetFilters}
                            className="ml-auto text-xs text-indigo-600 hover:text-indigo-800"
                        >
                            リセット
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* 管理者 */}
                    <select
                        value={selectedAdmin}
                        onChange={e => { setSelectedAdmin(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">全管理者</option>
                        {availableAdmins.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>

                    {/* アクション */}
                    <select
                        value={selectedAction}
                        onChange={e => { setSelectedAction(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">全アクション</option>
                        {availableActions.map(a => (
                            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                        ))}
                    </select>

                    {/* 対象タイプ */}
                    <select
                        value={selectedTargetType}
                        onChange={e => { setSelectedTargetType(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">全対象</option>
                        {availableTargetTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    {/* 日付範囲 */}
                    <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs flex-shrink-0">〜</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3">日時</th>
                                <th className="px-4 py-3">管理者</th>
                                <th className="px-4 py-3">アクション</th>
                                <th className="px-4 py-3">対象</th>
                                <th className="px-4 py-3">対象ID</th>
                                <th className="px-4 py-3 text-center">詳細</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                        読み込み中...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                        ログがありません
                                    </td>
                                </tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                        {formatDate(log.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{log.admin_name}</p>
                                                {log.admin_email && (
                                                    <p className="text-xs text-gray-400">{log.admin_email}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                            {ACTION_LABELS[log.action] || log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {log.target_type || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                                        {log.target_id ?? '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {log.details && (
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="詳細を表示"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ページネーション */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <p className="text-xs text-gray-500">
                            {total.toLocaleString()}件中 {((page - 1) * 30) + 1}〜{Math.min(page * 30, total)}件
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-600">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 詳細モーダル */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">操作詳細</h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                aria-label="閉じる"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <dl className="space-y-3 text-sm">
                                <div className="flex gap-3">
                                    <dt className="w-24 text-gray-500 flex-shrink-0">日時</dt>
                                    <dd className="text-gray-800">{formatDate(selectedLog.created_at)}</dd>
                                </div>
                                <div className="flex gap-3">
                                    <dt className="w-24 text-gray-500 flex-shrink-0">管理者</dt>
                                    <dd className="text-gray-800">{selectedLog.admin_name} ({selectedLog.admin_email})</dd>
                                </div>
                                <div className="flex gap-3">
                                    <dt className="w-24 text-gray-500 flex-shrink-0">アクション</dt>
                                    <dd>
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getActionColor(selectedLog.action)}`}>
                                            {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                                        </span>
                                    </dd>
                                </div>
                                <div className="flex gap-3">
                                    <dt className="w-24 text-gray-500 flex-shrink-0">対象</dt>
                                    <dd className="text-gray-800">{selectedLog.target_type} #{selectedLog.target_id ?? '-'}</dd>
                                </div>
                                {selectedLog.ip_address && (
                                    <div className="flex gap-3">
                                        <dt className="w-24 text-gray-500 flex-shrink-0">IPアドレス</dt>
                                        <dd className="text-gray-800 font-mono text-xs">{selectedLog.ip_address}</dd>
                                    </div>
                                )}
                                {selectedLog.details && (
                                    <div>
                                        <dt className="text-gray-500 mb-2">詳細データ</dt>
                                        <dd>
                                            <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto border border-gray-200">
                                                {JSON.stringify(selectedLog.details, null, 2)}
                                            </pre>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    </div>
                </div>
            )}

            {/* ヘルプモーダル */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-lg font-bold text-gray-900">取得対象の操作一覧</h3>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                aria-label="閉じる"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <p className="text-sm text-gray-500 mb-5">
                                システム管理者が行った操作のうち、以下のアクションがログとして記録されます。
                            </p>
                            <div className="space-y-6">
                                {LOG_CATEGORIES.map(cat => (
                                    <div key={cat.category}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {cat.tracked ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                            )}
                                            <h4 className="text-sm font-semibold text-gray-800">{cat.category}</h4>
                                            {!cat.tracked && (
                                                <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">未対応</span>
                                            )}
                                        </div>
                                        <div className="ml-6 space-y-1.5">
                                            {cat.items.map((item, i) => (
                                                <div key={i} className="flex items-start gap-3 text-sm">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${
                                                        cat.tracked ? getActionColor(item.action) : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        {item.label}
                                                    </span>
                                                    <span className="text-gray-500">{item.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
