'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Mail, MessageSquare, FileText, Loader2, Tag, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getSystemTemplates, updateSystemTemplates, getQualificationAbbreviations, updateQualificationAbbreviations, resetQualificationAbbreviations } from '@/src/lib/content-actions';
import { JobDescriptionFormatManager } from '@/components/system-admin/JobDescriptionFormatManager';
import { QUALIFICATION_GROUPS, DEFAULT_QUALIFICATION_ABBREVIATIONS } from '@/constants/qualifications';

export default function TemplateManagementPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'support' | 'welcome' | 'job' | 'qualification'>('support');

    // 資格略称データ
    const [abbreviations, setAbbreviations] = useState<Record<string, string>>({});
    const [abbreviationSearch, setAbbreviationSearch] = useState('');

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
                const [templates, abbrevData] = await Promise.all([
                    getSystemTemplates(),
                    getQualificationAbbreviations()
                ]);
                setFormData({
                    support_email: templates.support_email || '',
                    support_phone: templates.support_phone || '',
                    support_department: templates.support_department || '',
                    support_hours: templates.support_hours || '',
                    welcome_message_template: templates.welcome_message_template || '',
                });
                setAbbreviations(abbrevData);
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
        { id: 'qualification', label: '資格略称', icon: Tag },
    ];

    // 資格略称の更新
    const handleAbbreviationChange = (qualification: string, abbreviation: string) => {
        setAbbreviations(prev => ({
            ...prev,
            [qualification]: abbreviation
        }));
    };

    // 資格略称の保存
    const handleSaveAbbreviations = async () => {
        setIsSaving(true);
        try {
            const result = await updateQualificationAbbreviations(abbreviations);
            if (result.success) {
                toast.success('資格略称を保存しました');
            } else {
                toast.error(result.error || '保存に失敗しました');
            }
        } catch (error) {
            console.error('Failed to save abbreviations:', error);
            toast.error('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 資格略称のリセット
    const handleResetAbbreviations = async () => {
        if (!confirm('資格略称をデフォルトに戻しますか？変更した内容は失われます。')) {
            return;
        }
        setIsSaving(true);
        try {
            const result = await resetQualificationAbbreviations();
            if (result.success) {
                setAbbreviations({ ...DEFAULT_QUALIFICATION_ABBREVIATIONS });
                toast.success('デフォルトに戻しました');
            } else {
                toast.error(result.error || 'リセットに失敗しました');
            }
        } catch (error) {
            console.error('Failed to reset abbreviations:', error);
            toast.error('リセットに失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 資格のフィルタリング
    const filteredQualificationGroups = QUALIFICATION_GROUPS.map(group => ({
        ...group,
        qualifications: group.qualifications.filter(q =>
            abbreviationSearch === '' ||
            q.toLowerCase().includes(abbreviationSearch.toLowerCase()) ||
            (abbreviations[q] || '').toLowerCase().includes(abbreviationSearch.toLowerCase())
        )
    })).filter(group => group.qualifications.length > 0);

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

                    {/* 資格略称管理 */}
                    {activeTab === 'qualification' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-1">資格略称</h2>
                                    <p className="text-sm text-gray-500">
                                        表示スペースが限られる場所で使用される略称です。<br />
                                        6文字以上の資格名は自動で「...」と省略されます。登録がない場合は正式名称で表示されます。<br />
                                        <span className="text-orange-500">●</span> はデフォルトから変更された項目です。
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleResetAbbreviations}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        デフォルトに戻す
                                    </button>
                                    <button
                                        onClick={handleSaveAbbreviations}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        保存
                                    </button>
                                </div>
                            </div>

                            {/* 検索 */}
                            <div>
                                <input
                                    type="text"
                                    value={abbreviationSearch}
                                    onChange={(e) => setAbbreviationSearch(e.target.value)}
                                    placeholder="資格名または略称で検索..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* 資格グループごとの略称一覧 */}
                            <div className="space-y-6">
                                {filteredQualificationGroups.map(group => (
                                    <div key={group.name} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                            <h3 className="font-medium text-gray-900">{group.name}</h3>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {group.qualifications.map(qual => (
                                                <div key={qual} className="flex items-center gap-4 px-4 py-3">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm text-gray-900">{qual}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400">→</span>
                                                        <input
                                                            type="text"
                                                            value={abbreviations[qual] || ''}
                                                            onChange={(e) => handleAbbreviationChange(qual, e.target.value)}
                                                            placeholder="略称"
                                                            className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                        />
                                                        {abbreviations[qual] !== DEFAULT_QUALIFICATION_ABBREVIATIONS[qual] && (
                                                            <span className="text-xs text-orange-500" title="デフォルトから変更されています">
                                                                ●
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* 無資格可 */}
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                        <h3 className="font-medium text-gray-900">その他</h3>
                                    </div>
                                    <div className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-gray-900">無資格可</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">→</span>
                                                <input
                                                    type="text"
                                                    value={abbreviations['無資格可'] || ''}
                                                    onChange={(e) => handleAbbreviationChange('無資格可', e.target.value)}
                                                    placeholder="略称"
                                                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                />
                                                {abbreviations['無資格可'] !== DEFAULT_QUALIFICATION_ABBREVIATIONS['無資格可'] && (
                                                    <span className="text-xs text-orange-500" title="デフォルトから変更されています">
                                                        ●
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-blue-800 mb-2">使用箇所</h3>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• 応募管理 → シフトビュー（求人カードの資格表示）</li>
                                    <li>• その他、表示スペースが限られる場所</li>
                                </ul>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
