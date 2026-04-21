'use client';

import { useState, useEffect } from 'react';
import { getSystemAdmins, createSystemAdmin, deleteSystemAdmin, updateSystemAdminNotificationEmail, updateSystemAdmin } from '@/src/lib/system-actions';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import { Users, Plus, Trash2, Shield, ShieldAlert, User, Mail, Pencil, Check, X, Settings, HelpCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface SystemAdmin {
    id: number;
    name: string;
    email: string;
    notification_email: string | null;
    role: string;
    created_at: Date;
}

export default function SystemAdminsPage() {
    const { admin, isAdminLoading } = useSystemAuth();
    const { showDebugError } = useDebugError();
    const [admins, setAdmins] = useState<SystemAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', role: 'admin' });
    const [createdCredentials, setCreatedCredentials] = useState<{ password: string } | null>(null);

    // 通知メール編集state
    const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
    const [editingEmail, setEditingEmail] = useState('');

    // 名前編集state
    const [editingNameId, setEditingNameId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    // 権限編集state
    const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
    const [editingRole, setEditingRole] = useState('');

    // 権限ツールチップstate
    const [showRoleTooltip, setShowRoleTooltip] = useState(false);

    const isSuperAdmin = admin?.role === 'super_admin';

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const data = await getSystemAdmins();
            setAdmins(data);
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'fetch',
                operation: 'システム管理者一覧取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack
            });
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    // メールアドレス形式チェック
    // ドメイン先頭は英数字必須: `user@+domain.com` のような Resend が400を返す形式を事前に弾く
    // （sendNotification の低レベルガードと同一パターン）
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[a-zA-Z0-9][^\s@]*\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        // バリデーション
        if (!newAdmin.name?.trim()) {
            toast.error('名前を入力してください');
            return;
        }
        const trimmedEmail = newAdmin.email?.trim() ?? '';
        if (!trimmedEmail) {
            toast.error('メールアドレスを入力してください');
            return;
        }
        if (!isValidEmail(trimmedEmail)) {
            toast.error('メールアドレスの形式が正しくありません');
            return;
        }

        try {
            // trim 済みのアドレスを渡して、空白入りデータがDBに保存されるのを防ぐ
            const result = await createSystemAdmin({ ...newAdmin, email: trimmedEmail });
            if (result.success && result.initialPassword) {
                toast.success('管理者を作成しました');
                setCreatedCredentials({ password: result.initialPassword });
                fetchAdmins();
                setNewAdmin({ name: '', email: '', role: 'admin' });
            } else {
                toast.error(result.error || '作成に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'save',
                operation: 'システム管理者作成',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { newAdmin }
            });
            toast.error('エラーが発生しました');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            const result = await deleteSystemAdmin(id);
            if (result.success) {
                toast.success('削除しました');
                fetchAdmins();
            } else {
                toast.error('削除に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'delete',
                operation: 'システム管理者削除',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { id }
            });
            toast.error('エラーが発生しました');
        }
    };

    // --- 通知メール編集 ---
    const startEditNotificationEmail = (item: SystemAdmin) => {
        cancelAllEdits();
        setEditingEmailId(item.id);
        setEditingEmail(item.notification_email || '');
    };

    const cancelEditNotificationEmail = () => {
        setEditingEmailId(null);
        setEditingEmail('');
    };

    const saveNotificationEmail = async (id: number) => {
        const trimmed = editingEmail.trim();
        if (trimmed && !isValidEmail(trimmed)) {
            toast.error('メールアドレスの形式が正しくありません');
            return;
        }
        try {
            const result = await updateSystemAdminNotificationEmail(id, trimmed || null);
            if (result.success) {
                toast.success('通知先メールを更新しました');
                cancelEditNotificationEmail();
                fetchAdmins();
            } else {
                toast.error(result.error || '更新に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'save',
                operation: '通知先メール更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { id, editingEmail }
            });
            toast.error('エラーが発生しました');
        }
    };

    // --- 名前編集 ---
    const startEditName = (item: SystemAdmin) => {
        cancelAllEdits();
        setEditingNameId(item.id);
        setEditingName(item.name);
    };

    const cancelEditName = () => {
        setEditingNameId(null);
        setEditingName('');
    };

    const saveNameEdit = async (id: number) => {
        const trimmed = editingName.trim();
        if (!trimmed) {
            toast.error('名前を入力してください');
            return;
        }
        try {
            const result = await updateSystemAdmin(id, { name: trimmed });
            if (result.success) {
                toast.success('名前を更新しました');
                cancelEditName();
                fetchAdmins();
            } else {
                toast.error(result.error || '更新に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'save',
                operation: '名前更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { id, editingName }
            });
            toast.error('エラーが発生しました');
        }
    };

    // --- 権限編集 ---
    const startEditRole = (item: SystemAdmin) => {
        cancelAllEdits();
        setEditingRoleId(item.id);
        setEditingRole(item.role);
    };

    const cancelEditRole = () => {
        setEditingRoleId(null);
        setEditingRole('');
    };

    const saveRoleEdit = async (id: number) => {
        try {
            const result = await updateSystemAdmin(id, { role: editingRole });
            if (result.success) {
                toast.success('権限を更新しました');
                cancelEditRole();
                fetchAdmins();
            } else {
                toast.error(result.error || '更新に失敗しました');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'save',
                operation: '権限更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { id, editingRole }
            });
            toast.error('エラーが発生しました');
        }
    };

    // 全編集をキャンセル
    const cancelAllEdits = () => {
        setEditingEmailId(null);
        setEditingEmail('');
        setEditingNameId(null);
        setEditingName('');
        setEditingRoleId(null);
        setEditingRole('');
    };

    const closeModal = () => {
        setShowModal(false);
        setCreatedCredentials(null);
    }

    // super_admin以外はアクセス拒否
    if (!isAdminLoading && admin?.role !== 'super_admin') {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
                <h1 className="text-xl font-bold text-slate-800 mb-2">アクセス権限がありません</h1>
                <p className="text-slate-500">このページは特権管理者(super_admin)のみアクセスできます。</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* サブメニュー */}
            <div className="flex gap-2 mb-6">
                <Link
                    href="/system-admin/settings/system"
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    <Settings className="w-4 h-4" />
                    システム設定
                </Link>
                <Link
                    href="/system-admin/settings/admins"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                >
                    <Users className="w-4 h-4" />
                    管理者管理
                </Link>
                <Link
                    href="/system-admin/settings/form-destinations"
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    <Send className="w-4 h-4" />
                    フォーム送信先管理
                </Link>
            </div>

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">管理者アカウント管理</h1>
                    <p className="text-slate-500">システム管理者の追加・編集・削除</p>
                </div>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        管理者を追加
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">名前</th>
                            <th className="px-6 py-4">ログインメール</th>
                            <th className="px-6 py-4">通知先メール</th>
                            <th className="px-6 py-4">
                                <div className="flex items-center gap-1 relative">
                                    権限
                                    <button
                                        type="button"
                                        onClick={() => setShowRoleTooltip(!showRoleTooltip)}
                                        onBlur={() => setTimeout(() => setShowRoleTooltip(false), 150)}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                    </button>
                                    {showRoleTooltip && (
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 text-white text-xs font-normal normal-case rounded-lg shadow-lg p-4 z-50">
                                            <div className="mb-3">
                                                <p className="font-semibold text-indigo-300 mb-1">super_admin（特権管理者）</p>
                                                <ul className="space-y-0.5 text-slate-300">
                                                    <li>・全ての管理機能にアクセス可能</li>
                                                    <li>・管理者アカウントの追加・削除・権限変更</li>
                                                    <li>・システム設定の変更</li>
                                                    <li>・開発ポータルへのアクセス</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-emerald-300 mb-1">admin（管理者）</p>
                                                <ul className="space-y-0.5 text-slate-300">
                                                    <li>・ダッシュボード・アナリティクス</li>
                                                    <li>・ワーカー・施設・求人・勤怠管理</li>
                                                    <li>・CSV出力・コンテンツ・LP管理</li>
                                                </ul>
                                            </div>
                                            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 rotate-45"></div>
                                        </div>
                                    )}
                                </div>
                            </th>
                            <th className="px-6 py-4">作成日</th>
                            <th className="px-6 py-4 text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">読み込み中...</td></tr>
                        ) : admins.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">{item.id}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {editingNameId === item.id ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                className="px-2 py-1 border border-slate-300 rounded text-sm w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveNameEdit(item.id);
                                                    if (e.key === 'Escape') cancelEditName();
                                                }}
                                            />
                                            <button
                                                onClick={() => saveNameEdit(item.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                title="保存"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={cancelEditName}
                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                title="キャンセル"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                <User className="w-4 h-4 text-slate-400" />
                                            </div>
                                            {item.name}
                                            {admin?.email === item.email && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-1">あなた</span>}
                                            <button
                                                onClick={() => startEditName(item)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded ml-1"
                                                title="名前を編集"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-600 text-sm">{item.email}</td>
                                <td className="px-6 py-4">
                                    {editingEmailId === item.id ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="email"
                                                className="px-2 py-1 border border-slate-300 rounded text-sm w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                value={editingEmail}
                                                onChange={e => setEditingEmail(e.target.value)}
                                                placeholder="空欄でログインメール使用"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveNotificationEmail(item.id);
                                                    if (e.key === 'Escape') cancelEditNotificationEmail();
                                                }}
                                            />
                                            <button
                                                onClick={() => saveNotificationEmail(item.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                title="保存"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={cancelEditNotificationEmail}
                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                title="キャンセル"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            {item.notification_email ? (
                                                <span className="text-sm text-slate-700 flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-indigo-500" />
                                                    {item.notification_email}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">（ログインメール使用）</span>
                                            )}
                                            <button
                                                onClick={() => startEditNotificationEmail(item)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded ml-1"
                                                title="通知先メールを編集"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingRoleId === item.id ? (
                                        <div className="flex items-center gap-1">
                                            <select
                                                className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                value={editingRole}
                                                onChange={e => setEditingRole(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Escape') cancelEditRole();
                                                }}
                                            >
                                                <option value="admin">admin</option>
                                                <option value="super_admin">super_admin</option>
                                            </select>
                                            <button
                                                onClick={() => saveRoleEdit(item.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                title="保存"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={cancelEditRole}
                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                title="キャンセル"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="flex items-center gap-1 text-sm text-slate-600">
                                                <Shield className="w-3 h-3" />
                                                {item.role}
                                            </span>
                                            {isSuperAdmin && admin?.email !== item.email && (
                                                <button
                                                    onClick={() => startEditRole(item)}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded ml-1"
                                                    title="権限を編集"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {format(new Date(item.created_at), 'yyyy/MM/dd')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {isSuperAdmin && admin?.email !== item.email && (
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">管理者を追加</h2>
                            <button
                                onClick={closeModal}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                aria-label="閉じる"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {createdCredentials ? (
                            <div className="bg-green-50 p-4 rounded-lg mb-6 border border-green-100">
                                <p className="text-green-800 font-medium mb-2">作成完了しました</p>
                                <p className="text-sm text-green-700 mb-4">以下の初期パスワードを管理者に伝えてください。</p>
                                <div className="bg-white p-3 rounded border border-green-200 text-center font-mono text-lg font-bold select-all">
                                    {createdCredentials.password}
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="mt-4 w-full bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300"
                                >
                                    閉じる
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">名前</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                        value={newAdmin.name}
                                        onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                        value={newAdmin.email}
                                        onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">権限</label>
                                    <select
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white"
                                        value={newAdmin.role}
                                        onChange={e => setNewAdmin({ ...newAdmin, role: e.target.value })}
                                    >
                                        <option value="admin">管理者 (admin)</option>
                                        <option value="super_admin">特権管理者 (super_admin)</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        作成する
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
