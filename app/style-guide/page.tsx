'use client';

import { useState } from 'react';
import {
    CheckCircle2,
    AlertCircle,
    X,
    Search,
    ChevronDown,
    User,
    Bell,
    Menu,
    Home,
    Briefcase,
    Settings,
    Star,
    Heart,
    Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function StyleGuidePage() {
    const [activeTab, setActiveTab] = useState('colors');

    const tabs = [
        { id: 'colors', label: 'カラーパレット' },
        { id: 'typography', label: 'タイポグラフィ' },
        { id: 'buttons', label: 'ボタン' },
        { id: 'components', label: 'UIコンポーネント' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">スタイルガイド</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id
                                            ? 'bg-primary text-white'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Colors Section */}
                {activeTab === 'colors' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">カラーパレット</h2>
                            <p className="text-gray-500 mb-6">コードベースから抽出された色。</p>

                            <div className="space-y-6">
                                {/* Primary Colors */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">プライマリーカラー</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <ColorCard name="primary" class="bg-primary" hex="#66cc99" />
                                        <ColorCard name="primary-dark" class="bg-primary-dark" hex="#52b885" />
                                        <ColorCard name="primary-light" class="bg-primary-light" hex="#e6f7f0" />
                                    </div>
                                </div>

                                {/* Gray Scale */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">グレースケール</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <ColorCard name="bg-white" class="bg-white" hex="#ffffff" border />
                                        <ColorCard name="bg-gray-50" class="bg-gray-50" hex="#f9fafb" border />
                                        <ColorCard name="bg-gray-100" class="bg-gray-100" hex="#f3f4f6" />
                                        <ColorCard name="bg-gray-200" class="bg-gray-200" hex="#e5e7eb" />
                                        <ColorCard name="bg-gray-300" class="bg-gray-300" hex="#d1d5db" />
                                        <ColorCard name="bg-gray-500" class="bg-gray-500" hex="#6b7280" text="text-white" />
                                        <ColorCard name="bg-gray-600" class="bg-gray-600" hex="#4b5563" text="text-white" />
                                        <ColorCard name="bg-gray-700" class="bg-gray-700" hex="#374151" text="text-white" />
                                        <ColorCard name="bg-gray-800" class="bg-gray-800" hex="#1f2937" text="text-white" />
                                        <ColorCard name="bg-gray-900" class="bg-gray-900" hex="#111827" text="text-white" />
                                        <ColorCard name="bg-black" class="bg-black" hex="#000000" text="text-white" />
                                    </div>
                                </div>

                                {/* Status Colors */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">ステータス / アクセント</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {/* Blue */}
                                        <ColorCard name="bg-blue-50" class="bg-blue-50" hex="#eff6ff" border />
                                        <ColorCard name="bg-blue-100" class="bg-blue-100" hex="#dbeafe" />
                                        <ColorCard name="bg-blue-500" class="bg-blue-500" hex="#3b82f6" text="text-white" />
                                        <ColorCard name="bg-blue-600" class="bg-blue-600" hex="#2563eb" text="text-white" />

                                        {/* Green */}
                                        <ColorCard name="bg-green-50" class="bg-green-50" hex="#f0fdf4" border />
                                        <ColorCard name="bg-green-100" class="bg-green-100" hex="#dcfce7" />
                                        <ColorCard name="bg-green-500" class="bg-green-500" hex="#22c55e" text="text-white" />
                                        <ColorCard name="bg-green-600" class="bg-green-600" hex="#16a34a" text="text-white" />

                                        {/* Red */}
                                        <ColorCard name="bg-red-50" class="bg-red-50" hex="#fef2f2" border />
                                        <ColorCard name="bg-red-100" class="bg-red-100" hex="#fee2e2" />
                                        <ColorCard name="bg-red-500" class="bg-red-500" hex="#ef4444" text="text-white" />
                                        <ColorCard name="bg-red-600" class="bg-red-600" hex="#dc2626" text="text-white" />

                                        {/* Yellow/Orange */}
                                        <ColorCard name="bg-yellow-50" class="bg-yellow-50" hex="#fefce8" border />
                                        <ColorCard name="bg-yellow-100" class="bg-yellow-100" hex="#fef9c3" />
                                        <ColorCard name="bg-yellow-400" class="bg-yellow-400" hex="#facc15" />
                                        <ColorCard name="bg-orange-50" class="bg-orange-50" hex="#fff7ed" border />
                                        <ColorCard name="bg-orange-500" class="bg-orange-500" hex="#f97316" text="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Typography Section */}
                {activeTab === 'typography' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">タイポグラフィ</h2>
                            <p className="text-gray-500 mb-6">アプリケーションで使用されているフォントサイズと太さ。</p>

                            <div className="bg-white rounded-lg shadow p-6 space-y-8">
                                {/* Actual Font Sizes */}
                                <div className="space-y-4 border-b border-gray-100 pb-8">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">実際の使用サイズ</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-8xl</p>
                                            <p className="text-8xl text-gray-900">Aa</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-4xl</p>
                                            <p className="text-4xl text-gray-900">Aa - 見出し1</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-3xl</p>
                                            <p className="text-3xl text-gray-900">Aa - 見出し2</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-2xl</p>
                                            <p className="text-2xl text-gray-900">Aa - 見出し3</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-xl</p>
                                            <p className="text-xl text-gray-900">Aa - 見出し4</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-lg</p>
                                            <p className="text-lg text-gray-900">Aa - 見出し5 / 強調本文</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-base</p>
                                            <p className="text-base text-gray-900">Aa - 標準本文テキスト</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-sm</p>
                                            <p className="text-sm text-gray-900">Aa - 補足情報 / 小さなテキスト</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">text-xs</p>
                                            <p className="text-xs text-gray-900">Aa - 注釈 / ラベル</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Font Weights */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">フォントの太さ</h3>
                                    <div className="space-y-2">
                                        <p className="font-bold text-gray-900">font-bold (700)</p>
                                        <p className="font-semibold text-gray-900">font-semibold (600)</p>
                                        <p className="font-medium text-gray-900">font-medium (500)</p>
                                        <p className="font-normal text-gray-900">font-normal (400)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Buttons Section */}
                {activeTab === 'buttons' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">ボタン</h2>
                            <p className="text-gray-500 mb-6">アプリケーション内で発見されたボタンスタイル。</p>

                            <div className="bg-white rounded-lg shadow p-6 space-y-8">

                                {/* Actual Buttons */}
                                <div className="space-y-4 border-b border-gray-100 pb-8">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">実際の使用例</h3>
                                    <div className="space-y-6">

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">削除・閉じるボタン (text-gray-500 hover:text-red-600)</p>
                                            <button className="text-gray-500 hover:text-red-600">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">アイコンボタン (p-2 text-gray-400 hover:text-gray-600 transition-colors)</p>
                                            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                                <Bell className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">アクションテキスト (flex items-center gap-1 text-sm)</p>
                                            <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                                                <Star className="w-4 h-4" />
                                                <span>お気に入り</span>
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">リンク小 (text-xs text-blue-500 hover:underline)</p>
                                            <button className="text-xs text-blue-500 hover:underline">
                                                詳細を見る
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">ワーカー名リンク (font-bold text-gray-900 hover:text-primary hover:underline)</p>
                                            <button className="font-bold text-gray-900 hover:text-primary hover:underline">
                                                山田 太郎
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 mb-2">プライマリーリンク (text-sm text-primary hover:underline)</p>
                                            <button className="text-sm text-primary hover:underline">
                                                パスワードをお忘れですか？
                                            </button>
                                        </div>

                                    </div>
                                </div>

                                {/* Standard Buttons */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">基本スタイル</h3>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors">
                                            プライマリーボタン
                                        </button>
                                        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                                            アウトラインボタン
                                        </button>
                                        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                                            グレーボタン
                                        </button>
                                        <button disabled className="px-4 py-2 bg-primary/50 text-white rounded-md cursor-not-allowed">
                                            無効
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </section>
                )}

                {/* UI Components Section */}
                {activeTab === 'components' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">UIコンポーネント</h2>
                            <p className="text-gray-500 mb-6">一般的なUI要素とパターン。</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Badges */}
                                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900">バッジ</h3>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="default">デフォルト (Gray)</Badge>
                                        <Badge variant="blue">ブルー</Badge>
                                        <Badge variant="green">グリーン</Badge>
                                        <Badge variant="red">レッド</Badge>
                                        <Badge variant="yellow">イエロー</Badge>
                                        <Badge className="bg-purple-100 text-purple-800">カスタムパープル</Badge>
                                    </div>
                                </div>

                                {/* Form Elements */}
                                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900">フォーム要素</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">入力フィールド</label>
                                            <input
                                                type="text"
                                                placeholder="プレースホルダー"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">セレクトボックス</label>
                                            <div className="relative">
                                                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white">
                                                    <option>選択肢 1</option>
                                                    <option>選択肢 2</option>
                                                    <option>選択肢 3</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="check1" className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
                                            <label htmlFor="check1" className="text-sm text-gray-700">チェックボックス</label>
                                        </div>
                                    </div>
                                </div>

                                {/* Cards */}
                                <div className="bg-white rounded-lg shadow p-6 space-y-6 md:col-span-2">
                                    <h3 className="text-lg font-bold text-gray-900">カード</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Simple Card */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-gray-900 mb-2">シンプルカード</h4>
                                            <p className="text-sm text-gray-600">
                                                枠線とホバー時の影効果を持つ基本的なカード。リストやアイテムに使用。
                                            </p>
                                        </div>

                                        {/* Feature Card */}
                                        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                                <Star className="w-5 h-5 text-primary" />
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-2">機能カード</h4>
                                            <p className="text-sm text-gray-600">
                                                アイコン、影、角丸を持つカード。機能紹介やハイライトに使用。
                                            </p>
                                        </div>

                                        {/* Status Card */}
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <h4 className="font-bold text-blue-900 mb-1">情報カード</h4>
                                                    <p className="text-sm text-blue-700">
                                                        アラート、通知、またはステータスメッセージに使用。
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

function ColorCard({ name, class: className, hex, text = 'text-gray-900', border = false }: { name: string, class: string, hex: string, text?: string, border?: boolean }) {
    return (
        <div className="flex flex-col gap-2">
            <div className={`h-20 rounded-lg shadow-sm flex items-center justify-center ${className} ${border ? 'border border-gray-200' : ''}`}>
                <span className={`text-xs font-medium ${text}`}>{hex}</span>
            </div>
            <div className="text-center">
                <p className="text-xs font-medium text-gray-900">{name}</p>
                <p className="text-[10px] text-gray-500">{className}</p>
            </div>
        </div>
    );
}
