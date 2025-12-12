'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Mail, MessageSquare, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getSystemTemplates, updateSystemTemplates } from '@/src/lib/content-actions';
import { JobDescriptionFormatManager } from '@/components/system-admin/JobDescriptionFormatManager';

export default function TemplateManagementPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'support' | 'welcome' | 'job'>('support');

    // フォームデータ
    const [formData, setFormData] = useState({
        // サポート連絡先
        support_email: '',
        support_phone: '',
        support_department: '',
        support_hours: '',
        // 初回自動送信メッセージ
        welcome_message_template: '',
        // 解雇事由
    });

    // データ取得
    useEffect(() => {
        const fetchData = async () => {
            try {
                const templates = await getSystemTemplates();
                setFormData({
                    support_email: templates.support_email || '',
                    support_phone: templates.support_phone || '',
                    support_department: templates.support_department || '',
                    support_hours: templates.support_hours || '',
                    welcome_message_template: templates.welcome_message_template || '',

                });
            } catch (error) {
                console.error('Failed to fetch templates:', error);
                toast.error('テンプレートの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // 保存処理
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSystemTemplates(formData);
            toast.success('テンプレートを保存しました');
        } catch (error) {
            console.error('Failed to save templates:', error);
            toast.error('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 入力変更ハンドラ
    const handleChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const tabs = [
        { id: 'support', label: 'サポート連絡先', icon: Mail },
        { id: 'welcome', label: '初回メッセージ', icon: MessageSquare },
        { id: 'job', label: '仕事詳細', icon: FileText },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/system-admin/content" className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">テンプレート管理</h1>
                            <p className="text-sm text-gray-500">サービス全体のデフォルトテキストを編集</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        保存
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6">
                {/* タブ */}
                <div className="flex gap-2 mb-6 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* コンテンツ */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    {/* サポート連絡先 */}
                    {activeTab === 'support' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-1">サポート連絡先</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    お問い合わせページやFAQ等に表示される連絡先情報です。
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        メールアドレス
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.support_email}
                                        onChange={(e) => handleChange('support_email', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="support@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        電話番号
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.support_phone}
                                        onChange={(e) => handleChange('support_phone', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="03-1234-5678"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        担当部署名
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.support_department}
                                        onChange={(e) => handleChange('support_department', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="カスタマーサポート部"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        対応時間
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.support_hours}
                                        onChange={(e) => handleChange('support_hours', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="平日 9:00〜18:00"
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">表示箇所</h3>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• お問い合わせページ（/contact）</li>
                                    <li>• ワーカー向けFAQ（/faq）</li>
                                    <li>• 施設管理者向けFAQ（/admin/faq）</li>
                                    <li>• プライバシーポリシー</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* 初回自動送信メッセージ */}
                    {activeTab === 'welcome' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-1">初回自動送信メッセージ</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    施設が新規登録時に設定されるウェルカムメッセージの初期値です。
                                    施設側で個別に編集することもできます。
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    テンプレート本文
                                </label>
                                <textarea
                                    value={formData.welcome_message_template}
                                    onChange={(e) => handleChange('welcome_message_template', e.target.value)}
                                    rows={12}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                                />
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-blue-800 mb-2">使用可能な変数（クリックでコピー）</h3>
                                <ul className="text-sm text-blue-700 space-y-1.5">
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText('[ワーカー名字]');
                                                toast.success('コピーしました');
                                            }}
                                            className="bg-blue-100 px-1.5 py-0.5 rounded hover:bg-blue-200 transition-colors cursor-pointer font-mono"
                                        >
                                            [ワーカー名字]
                                        </button>
                                        <span className="ml-2">ワーカーの名字</span>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText('[施設名]');
                                                toast.success('コピーしました');
                                            }}
                                            className="bg-blue-100 px-1.5 py-0.5 rounded hover:bg-blue-200 transition-colors cursor-pointer font-mono"
                                        >
                                            [施設名]
                                        </button>
                                        <span className="ml-2">施設名</span>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText('[施設責任者名字]');
                                                toast.success('コピーしました');
                                            }}
                                            className="bg-blue-100 px-1.5 py-0.5 rounded hover:bg-blue-200 transition-colors cursor-pointer font-mono"
                                        >
                                            [施設責任者名字]
                                        </button>
                                        <span className="ml-2">施設責任者の名字</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* 仕事詳細フォーマット管理 */}
                    {activeTab === 'job' && (
                        <JobDescriptionFormatManager
                            onFormatCreated={() => {
                                // フォーマット作成後は仕事詳細タブに留まる（何もしない）
                            }}
                        />
                    )}


                </div>
            </div>
        </div>
    );
}
