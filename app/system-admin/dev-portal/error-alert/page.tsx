'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
    Mail,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Clock,
    Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

interface ErrorAlertRecipient {
    id: number;
    email: string;
    name: string | null;
    is_active: boolean;
    created_at: string;
}

interface SystemSetting {
    key: string;
    value: string;
    updated_at: string;
}

export default function ErrorAlertSettingsPage() {
    const [recipients, setRecipients] = useState<ErrorAlertRecipient[]>([]);
    const [lastChecked, setLastChecked] = useState<SystemSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 新規追加フォーム
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');

    // データ取得
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system-admin/error-alert-recipients');
            const data = await res.json();
            setRecipients(data.recipients || []);
            setLastChecked(data.lastChecked || null);
        } catch (error) {
            console.error('Failed to fetch error alert settings:', error);
            toast.error('設定の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 通知先追加
    const handleAdd = async () => {
        if (!newEmail.trim()) {
            toast.error('メールアドレスを入力してください');
            return;
        }

        // 簡易的なメール形式チェック
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            toast.error('有効なメールアドレスを入力してください');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/system-admin/error-alert-recipients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() || null }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '追加に失敗しました');
            }

            toast.success('通知先を追加しました');
            setNewEmail('');
            setNewName('');
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    // 有効/無効切り替え
    const handleToggle = async (id: number, currentActive: boolean) => {
        try {
            const res = await fetch('/api/system-admin/error-alert-recipients', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentActive }),
            });

            if (!res.ok) throw new Error('更新に失敗しました');

            toast.success(currentActive ? '無効にしました' : '有効にしました');
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    // 削除
    const handleDelete = async (id: number) => {
        if (!confirm('この通知先を削除しますか？')) return;

        try {
            const res = await fetch('/api/system-admin/error-alert-recipients', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (!res.ok) throw new Error('削除に失敗しました');

            toast.success('通知先を削除しました');
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    // テスト送信
    const handleTestSend = async () => {
        const activeRecipients = recipients.filter(r => r.is_active);
        if (activeRecipients.length === 0) {
            toast.error('有効な通知先がありません');
            return;
        }

        if (!confirm(`${activeRecipients.length}件の通知先にテストメールを送信しますか？`)) return;

        setSaving(true);
        try {
            const res = await fetch('/api/system-admin/error-alert-recipients/test', {
                method: 'POST',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '送信に失敗しました');
            }

            toast.success('テストメールを送信しました');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8">
            {/* ヘッダー */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    エラー通知設定
                </h1>
                <p className="text-slate-500">本番環境でエラーが発生した際の自動メール通知を設定します</p>
            </div>

            {/* ステータスカード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">通知先数</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {recipients.filter(r => r.is_active).length}
                                <span className="text-sm font-normal text-slate-400 ml-1">/ {recipients.length}</span>
                            </p>
                        </div>
                        <Mail className="w-8 h-8 text-slate-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">チェック間隔</p>
                            <p className="text-2xl font-bold text-indigo-600">5分</p>
                        </div>
                        <Clock className="w-8 h-8 text-indigo-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-500">最終チェック</p>
                            <p className="text-sm font-bold text-slate-800">
                                {lastChecked
                                    ? format(toZonedTime(new Date(lastChecked.value), 'Asia/Tokyo'), 'MM/dd HH:mm:ss', { locale: ja })
                                    : '未実行'}
                            </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-200" />
                    </div>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 新規追加フォーム */}
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-sm font-bold text-slate-700 mb-3">通知先を追加</h2>
                    <div className="flex flex-wrap gap-3">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="メールアドレス *"
                            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="名前（任意）"
                            className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={saving || !newEmail.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            追加
                        </button>
                    </div>
                </div>

                {/* 通知先一覧 */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-slate-700">通知先一覧</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={handleTestSend}
                                disabled={saving || recipients.filter(r => r.is_active).length === 0}
                                className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                <Send className="w-3 h-3" />
                                テスト送信
                            </button>
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                更新
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-8 text-center text-slate-500">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                            <p>読み込み中...</p>
                        </div>
                    ) : recipients.length === 0 ? (
                        <div className="py-8 text-center text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <p>通知先が登録されていません</p>
                            <p className="text-xs mt-1">上のフォームから通知先を追加してください</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recipients.map(recipient => (
                                <div
                                    key={recipient.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${recipient.is_active
                                            ? 'bg-white border-slate-200'
                                            : 'bg-slate-50 border-slate-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggle(recipient.id, recipient.is_active)}
                                            className={`transition-colors ${recipient.is_active ? 'text-green-500' : 'text-slate-300'}`}
                                            title={recipient.is_active ? '有効（クリックで無効化）' : '無効（クリックで有効化）'}
                                        >
                                            {recipient.is_active
                                                ? <ToggleRight className="w-6 h-6" />
                                                : <ToggleLeft className="w-6 h-6" />
                                            }
                                        </button>
                                        <div>
                                            <div className={`font-medium ${recipient.is_active ? 'text-slate-800' : 'text-slate-400'}`}>
                                                {recipient.email}
                                            </div>
                                            {recipient.name && (
                                                <div className="text-xs text-slate-500">{recipient.name}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">
                                            {format(toZonedTime(new Date(recipient.created_at), 'Asia/Tokyo'), 'yyyy/MM/dd', { locale: ja })}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(recipient.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 説明 */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <h3 className="text-xs font-bold text-slate-600 mb-2">仕組み</h3>
                    <ul className="text-xs text-slate-500 space-y-1">
                        <li>- 5分ごとに本番環境のエラーログをチェックします</li>
                        <li>- 新しいエラーがあれば、有効な通知先全員にダイジェストメールを送信します</li>
                        <li>- エラーの詳細は「バグ調査ダッシュボード」で確認できます</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
