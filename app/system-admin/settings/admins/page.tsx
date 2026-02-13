'use client';

import { useState, useEffect } from 'react';
import { getSystemAdmins, createSystemAdmin, deleteSystemAdmin, updateSystemAdminNotificationEmail } from '@/src/lib/system-actions';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import { Users, Plus, Trash2, Shield, User, Mail, Pencil, Check, X } from 'lucide-react';
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
    const { admin } = useSystemAuth();
    const { showDebugError } = useDebugError();
    const [admins, setAdmins] = useState<SystemAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', role: 'admin' });
    const [createdCredentials, setCreatedCredentials] = useState<{ password: string } | null>(null);

    // 通知メール編集state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingEmail, setEditingEmail] = useState('');

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
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        // バリデーション
        if (!newAdmin.name?.trim()) {
            toast.error('名前を入力してください');
            return;
        }
        if (!newAdmin.email?.trim()) {
            toast.error('メールアドレスを入力してください');
            return;
        }
        if (!isValidEmail(newAdmin.email)) {
            toast.error('メールアドレスの形式が正しくありません');
            return;
        }

        try {
            const result = await createSystemAdmin(newAdmin);
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

    const startEditNotificationEmail = (item: SystemAdmin) => {
        setEditingId(item.id);
        setEditingEmail(item.notification_email || '');
    };

    const cancelEditNotificationEmail = () => {
        setEditingId(null);
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
                setEditingId(null);
                setEditingEmail('');
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

    const closeModal = () => {
        setShowModal(false);
        setCreatedCredentials(null);
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">管理者アカウント管理</h1>
                    <p className="text-slate-500">システム管理者の追加・削除</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    管理者を追加
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">名前</th>
                            <th className="px-6 py-4">ログインメール</th>
                            <th className="px-6 py-4">通知先メール</th>
                            <th className="px-6 py-4">権限</th>
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
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User className="w-4 h-4 text-slate-400" />
                                        </div>
                                        {item.name}
                                        {admin?.email === item.email && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-1">あなた</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 text-sm">{item.email}</td>
                                <td className="px-6 py-4">
                                    {editingId === item.id ? (
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
                                    <span className="flex items-center gap-1 text-sm text-slate-600">
                                        <Shield className="w-3 h-3" />
                                        {item.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {format(new Date(item.created_at), 'yyyy/MM/dd')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {admin?.email !== item.email && (
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">管理者を追加</h2>

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
