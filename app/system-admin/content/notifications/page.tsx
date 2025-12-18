'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Bell, Mail, MessageCircle, Edit2, Save, X, Copy, Check, Settings, LayoutDashboard } from 'lucide-react';

interface NotificationSetting {
    id: number;
    notification_key: string;
    name: string;
    description: string | null;
    target_type: string;
    chat_enabled: boolean;
    email_enabled: boolean;
    push_enabled: boolean;
    dashboard_enabled: boolean;
    chat_message: string | null;
    email_subject: string | null;
    email_body: string | null;
    push_title: string | null;
    push_body: string | null;
    alert_thresholds: {
        avg_rating_threshold?: number;
        consecutive_low_rating_count?: number;
        low_rating_threshold?: number;
        cancel_rate_threshold?: number;
        consecutive_cancel_count?: number;
        distance_km?: number;
        max_notifications_per_day?: number;
        note?: string;
    } | null;
}

// 閾値設定が必要なnotification_key一覧
const ALERT_THRESHOLD_KEYS = [
    'ADMIN_WORKER_LOW_RATING_STREAK',
    'ADMIN_FACILITY_LOW_RATING_STREAK',
    'ADMIN_WORKER_HIGH_CANCEL_RATE',
    'ADMIN_FACILITY_HIGH_CANCEL_RATE',
    'WORKER_NEARBY_NEW_JOB',
    'WORKER_NEARBY_CANCEL_AVAILABLE',
];

// 低評価系かキャンセル系かを判定
const isLowRatingAlert = (key: string) => key.includes('LOW_RATING');
const isCancelRateAlert = (key: string) => key.includes('CANCEL_RATE');



type TabType = 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN' | 'ERROR_MESSAGE';

interface ErrorMessageSetting {
    id: number;
    key: string;
    title: string;
    banner_message: string;
    detail_message: string;
    banner_enabled: boolean;
    chat_enabled: boolean;
    email_enabled: boolean;
    push_enabled: boolean;
}

const AVAILABLE_VARIABLES = [
    { key: '{{worker_name}}', description: 'ワーカー名' },
    { key: '{{worker_last_name}}', description: 'ワーカー姓' },
    { key: '{{facility_name}}', description: '施設名' },
    { key: '{{job_title}}', description: '求人タイトル' },
    { key: '{{work_date}}', description: '勤務日' },
    { key: '{{start_time}}', description: '開始時間' },
    { key: '{{end_time}}', description: '終了時間' },
    { key: '{{wage}}', description: '日給' },
    { key: '{{hourly_wage}}', description: '時給' },
    { key: '{{deadline}}', description: '締切日時' },
    { key: '{{review_url}}', description: 'レビュー投稿URL' },
    { key: '{{job_url}}', description: '求人詳細URL' },
    // Alet keys
    { key: '{{user_name}}', description: 'ユーザー名' },
    { key: '{{user_id}}', description: 'ユーザーID' },
    { key: '{{facility_name}}', description: '施設名' },
    { key: '{{facility_id}}', description: '施設ID' },
    { key: '{{average_rating}}', description: '平均評価' },
    { key: '{{low_rating_count}}', description: '低評価件数' },
    { key: '{{trigger_reason}}', description: '発生条件' },
    { key: '{{cancel_rate}}', description: 'キャンセル率' },
    { key: '{{consecutive_cancels}}', description: '連続キャンセル数' },
];

export default function NotificationManagementPage() {
    const [settings, setSettings] = useState<NotificationSetting[]>([]);
    const [errorMessages, setErrorMessages] = useState<ErrorMessageSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('WORKER');
    const [editingSetting, setEditingSetting] = useState<NotificationSetting | null>(null);
    const [editingErrorMessage, setEditingErrorMessage] = useState<ErrorMessageSetting | null>(null);
    const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'ERROR_MESSAGE') {
            fetchErrorMessageSettings();
        } else {
            fetchSettings();
        }
    }, [activeTab]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system-admin/notification-settings');
            const data = await res.json();
            setSettings(data);
        } catch (error) {
            toast.error('設定の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const fetchErrorMessageSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system-admin/error-messages');
            const data = await res.json();
            setErrorMessages(data);
        } catch (error) {
            toast.error('エラーメッセージの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (id: number, field: 'chat_enabled' | 'email_enabled' | 'push_enabled' | 'dashboard_enabled') => {
        const setting = settings.find(s => s.id === id);
        if (!setting) return;

        const newValue = !setting[field];

        try {
            const res = await fetch(`/api/system-admin/notification-settings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: newValue }),
            });

            if (res.ok) {
                setSettings(prev =>
                    prev.map(s => s.id === id ? { ...s, [field]: newValue } : s)
                );
                toast.success('設定を更新しました');
            }
        } catch (error) {
            toast.error('更新に失敗しました');
        }
    };

    const handleSaveTemplate = async () => {
        if (!editingSetting) return;

        try {
            const res = await fetch(`/api/system-admin/notification-settings/${editingSetting.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_message: editingSetting.chat_message,
                    email_subject: editingSetting.email_subject,
                    email_body: editingSetting.email_body,
                    push_title: editingSetting.push_title,
                    push_body: editingSetting.push_body,
                    alert_thresholds: editingSetting.alert_thresholds,
                }),
            });

            if (res.ok) {
                setSettings(prev =>
                    prev.map(s => s.id === editingSetting.id ? editingSetting : s)
                );
                setEditingSetting(null);
                toast.success('テンプレートを保存しました');
            }
        } catch (error) {
            toast.error('保存に失敗しました');
        }
    };

    const handleErrorMessageToggle = async (id: number, field: 'banner_enabled' | 'chat_enabled' | 'email_enabled' | 'push_enabled') => {
        const msg = errorMessages.find(m => m.id === id);
        if (!msg) return;

        const newValue = !msg[field];

        try {
            const res = await fetch('/api/system-admin/error-messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    enable_field: field,
                    value: newValue
                }),
            });

            if (res.ok) {
                setErrorMessages(prev =>
                    prev.map(m => m.id === id ? { ...m, [field]: newValue } : m)
                );
                toast.success('設定を更新しました');
            } else {
                toast.error('更新に失敗しました');
            }
        } catch (error) {
            toast.error('更新に失敗しました');
        }
    };

    const handleSaveErrorMessage = async () => {
        if (!editingErrorMessage) return;

        try {
            const res = await fetch('/api/system-admin/error-messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingErrorMessage.id,
                    title: editingErrorMessage.title,
                    banner_message: editingErrorMessage.banner_message,
                    detail_message: editingErrorMessage.detail_message,
                    banner_enabled: editingErrorMessage.banner_enabled,
                    chat_enabled: editingErrorMessage.chat_enabled,
                    email_enabled: editingErrorMessage.email_enabled,
                    push_enabled: editingErrorMessage.push_enabled,
                }),
            });

            if (res.ok) {
                setErrorMessages(prev =>
                    prev.map(m => m.id === editingErrorMessage.id ? editingErrorMessage : m)
                );
                setEditingErrorMessage(null);
                toast.success('エラーメッセージを保存しました');
            } else {
                toast.error('保存に失敗しました');
            }
        } catch (error) {
            toast.error('保存に失敗しました');
        }
    };

    const copyVariable = (variable: string) => {
        navigator.clipboard.writeText(variable);
        setCopiedVariable(variable);
        setTimeout(() => setCopiedVariable(null), 2000);
    };

    const filteredSettings = settings.filter(s => s.target_type === activeTab);

    const tabs: { key: TabType; label: string }[] = [
        { key: 'WORKER', label: 'ワーカー向け' },
        { key: 'FACILITY', label: '施設向け' },
        { key: 'SYSTEM_ADMIN', label: 'システム管理者向け' },
        { key: 'ERROR_MESSAGE', label: 'エラーメッセ' },
    ];

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">通知管理</h1>
                <p className="text-slate-500">通知のON/OFF切り替え、テンプレートの編集を行います</p>
            </div>

            {/* タブ */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.key
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 通知一覧 */}
            {activeTab !== 'ERROR_MESSAGE' ? (
                <div className="space-y-4">
                    {filteredSettings.map(setting => (
                        <div
                            key={setting.id}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-slate-800">{setting.name}</h3>
                                    {setting.description && (
                                        <p className="text-sm text-slate-500 mt-1">{setting.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setEditingSetting(setting)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    編集
                                </button>
                            </div>

                            {/* チャンネル別ON/OFF */}
                            <div className="flex gap-6">
                                {/* システム管理者向け: ダッシュボードアラートとメールのみ */}
                                {setting.target_type === 'SYSTEM_ADMIN' ? (
                                    <>
                                        {/* ダッシュボードアラート */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={setting.dashboard_enabled}
                                                onChange={() => handleToggle(setting.id, 'dashboard_enabled')}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <LayoutDashboard className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">ダッシュボード</span>
                                        </label>

                                        {/* メール */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={setting.email_enabled}
                                                onChange={() => handleToggle(setting.id, 'email_enabled')}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">メール</span>
                                        </label>
                                    </>
                                ) : (
                                    <>
                                        {/* チャット */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={setting.chat_enabled}
                                                onChange={() => handleToggle(setting.id, 'chat_enabled')}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <MessageCircle className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">チャット</span>
                                        </label>

                                        {/* メール */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={setting.email_enabled}
                                                onChange={() => handleToggle(setting.id, 'email_enabled')}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">メール</span>
                                        </label>

                                        {/* プッシュ */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={setting.push_enabled}
                                                onChange={() => handleToggle(setting.id, 'push_enabled')}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <Bell className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">プッシュ</span>
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* エラーメッセージ一覧 */
                <div className="space-y-4">
                    {errorMessages.map(msg => (
                        <div
                            key={msg.id}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h3 className="font-semibold text-slate-800">{msg.title}</h3>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">{msg.key}</p>
                                </div>
                                <button
                                    onClick={() => setEditingErrorMessage(msg)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    編集
                                </button>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 text-xs font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                                {msg.banner_message}
                            </div>

                            {/* チャンネルステータス変更 */}
                            <div className="flex gap-6 border-t border-slate-100 pt-3">
                                {/* バナー */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={msg.banner_enabled}
                                        onChange={() => handleErrorMessageToggle(msg.id, 'banner_enabled')}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <LayoutDashboard className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">バナー</span>
                                </label>

                                {/* チャット */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={msg.chat_enabled}
                                        onChange={() => handleErrorMessageToggle(msg.id, 'chat_enabled')}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <MessageCircle className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">チャット</span>
                                </label>

                                {/* メール */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={msg.email_enabled}
                                        onChange={() => handleErrorMessageToggle(msg.id, 'email_enabled')}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">メール</span>
                                </label>

                                {/* プッシュ */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={msg.push_enabled}
                                        onChange={() => handleErrorMessageToggle(msg.id, 'push_enabled')}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Bell className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">プッシュ</span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 編集モーダル */}
            {editingSetting && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-lg font-bold text-slate-800">
                                テンプレート編集: {editingSetting.name}
                            </h2>
                            <button
                                onClick={() => setEditingSetting(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 変数リファレンス */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">利用可能な変数（クリックでコピー）</h3>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_VARIABLES.map(v => (
                                        <button
                                            key={v.key}
                                            onClick={() => copyVariable(v.key)}
                                            className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-mono hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                                            title={v.description}
                                        >
                                            {copiedVariable === v.key ? (
                                                <Check className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <Copy className="w-3 h-3 text-slate-400" />
                                            )}
                                            {v.key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* チャット通知 */}
                            {editingSetting.chat_enabled && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <MessageCircle className="w-4 h-4" />
                                        チャット通知
                                    </h3>
                                    <textarea
                                        value={editingSetting.chat_message || ''}
                                        onChange={e => setEditingSetting({ ...editingSetting, chat_message: e.target.value })}
                                        rows={6}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="チャットメッセージを入力..."
                                    />
                                </div>
                            )}

                            {/* メール */}
                            {editingSetting.email_enabled && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        メール
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">件名</label>
                                            <input
                                                type="text"
                                                value={editingSetting.email_subject || ''}
                                                onChange={e => setEditingSetting({ ...editingSetting, email_subject: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="メール件名を入力..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">本文</label>
                                            <textarea
                                                value={editingSetting.email_body || ''}
                                                onChange={e => setEditingSetting({ ...editingSetting, email_body: e.target.value })}
                                                rows={10}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                placeholder="メール本文を入力..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* プッシュ通知 */}
                            {editingSetting.push_enabled && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Bell className="w-4 h-4" />
                                        プッシュ通知
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">タイトル</label>
                                            <input
                                                type="text"
                                                value={editingSetting.push_title || ''}
                                                onChange={e => setEditingSetting({ ...editingSetting, push_title: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="プッシュ通知タイトルを入力..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">本文</label>
                                            <input
                                                type="text"
                                                value={editingSetting.push_body || ''}
                                                onChange={e => setEditingSetting({ ...editingSetting, push_body: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="プッシュ通知本文を入力..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* アラート閾値設定（システム管理者向けアラートのみ表示） */}
                            {ALERT_THRESHOLD_KEYS.includes(editingSetting.notification_key) && (
                                <div className="border-t border-slate-200 pt-6">
                                    <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        アラート条件設定
                                    </h3>

                                    {isLowRatingAlert(editingSetting.notification_key) && (
                                        <div className="space-y-4 bg-amber-50 rounded-lg p-4">
                                            <p className="text-xs text-amber-700 mb-3">
                                                以下の条件のいずれかを満たすとアラートが発動します（OR条件）
                                            </p>

                                            {/* 条件A: 平均評価 */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600 min-w-[120px]">条件A: 平均評価が</span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="1"
                                                    max="5"
                                                    value={editingSetting.alert_thresholds?.avg_rating_threshold || 2.5}
                                                    onChange={e => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            avg_rating_threshold: parseFloat(e.target.value)
                                                        }
                                                    })}
                                                    className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                                                />
                                                <span className="text-sm text-slate-600">点以下になった時</span>
                                            </div>

                                            {/* 条件B: 連続低評価 */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm text-slate-600 min-w-[120px]">条件B: 連続</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={editingSetting.alert_thresholds?.consecutive_low_rating_count || 3}
                                                    onChange={e => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            consecutive_low_rating_count: parseInt(e.target.value)
                                                        }
                                                    })}
                                                    className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                                                />
                                                <span className="text-sm text-slate-600">回、</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="5"
                                                    value={editingSetting.alert_thresholds?.low_rating_threshold || 2}
                                                    onChange={e => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            low_rating_threshold: parseInt(e.target.value)
                                                        }
                                                    })}
                                                    className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                                                />
                                                <span className="text-sm text-slate-600">点以下の評価を受けた時</span>
                                            </div>
                                        </div>
                                    )}

                                    {isCancelRateAlert(editingSetting.notification_key) && (
                                        <div className="space-y-4 bg-red-50 rounded-lg p-4">
                                            <p className="text-xs text-red-700 mb-3">
                                                以下の条件のいずれかを満たすとアラートが発動します（OR条件）
                                            </p>

                                            {/* 条件A: キャンセル率 */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600 min-w-[120px]">条件A: キャンセル率が</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={editingSetting.alert_thresholds?.cancel_rate_threshold || 30}
                                                    onChange={e => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            cancel_rate_threshold: parseInt(e.target.value)
                                                        }
                                                    })}
                                                    className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                                                />
                                                <span className="text-sm text-slate-600">%を超えた時</span>
                                            </div>

                                            {/* 条件B: 連続キャンセル */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600 min-w-[120px]">条件B: 連続</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={editingSetting.alert_thresholds?.consecutive_cancel_count || 3}
                                                    onChange={e => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            consecutive_cancel_count: parseInt(e.target.value)
                                                        }
                                                    })}
                                                    className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                                                />
                                                <span className="text-sm text-slate-600">回キャンセルした時</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 近隣通知設定（WORKER_NEARBY_*の場合のみ） */}
                                    {editingSetting.notification_key.startsWith('WORKER_NEARBY_') && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    通知距離（km）
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={editingSetting.alert_thresholds?.distance_km || 10}
                                                    onChange={(e) => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            distance_km: parseInt(e.target.value) || 10
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">
                                                    ワーカーの登録住所からこの距離以内の求人を通知対象とします
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    1日の最大通知数
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    value={editingSetting.alert_thresholds?.max_notifications_per_day || 5}
                                                    onChange={(e) => setEditingSetting({
                                                        ...editingSetting,
                                                        alert_thresholds: {
                                                            ...editingSetting.alert_thresholds,
                                                            max_notifications_per_day: parseInt(e.target.value) || 5
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">
                                                    1人のワーカーに1日に送る最大通知数
                                                </p>
                                            </div>
                                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                <p className="text-xs text-amber-700">
                                                    ⚠️ 現在国土地理院APIを利用しています。精度向上には有料のGoogle Geocoding APIが必要です。
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                            <button
                                onClick={() => setEditingSetting(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* エラーメッセージ編集モーダル */}
            {editingErrorMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800">
                                エラーメッセージ編集
                            </h2>
                            <button
                                onClick={() => setEditingErrorMessage(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* タイトル */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    タイトル
                                </label>
                                <input
                                    type="text"
                                    value={editingErrorMessage.title}
                                    onChange={e => setEditingErrorMessage({ ...editingErrorMessage, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* バナー用メッセージ */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    バナー表示メッセージ（短文）
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    画面上部に表示される短いメッセージ（50文字程度推奨）
                                </p>
                                <input
                                    type="text"
                                    value={editingErrorMessage.banner_message}
                                    onChange={e => setEditingErrorMessage({ ...editingErrorMessage, banner_message: e.target.value })}
                                    maxLength={100}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <p className="text-xs text-slate-400 mt-1 text-right">
                                    {editingErrorMessage.banner_message.length}/100
                                </p>
                            </div>

                            {/* 詳細メッセージ */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    詳細メッセージ（チャット/メール/プッシュ用）
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    お知らせやメールで送信される詳細な説明文
                                </p>
                                <textarea
                                    value={editingErrorMessage.detail_message}
                                    onChange={e => setEditingErrorMessage({ ...editingErrorMessage, detail_message: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingErrorMessage(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveErrorMessage}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
