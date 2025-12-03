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
        { id: 'worker', label: 'ワーカー向け' },
        { id: 'admin', label: '管理者向け' },
        { id: 'tag-styles', label: 'タグスタイル' },
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

                {/* Worker Section */}
                {activeTab === 'worker' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">ワーカー向けデザイン（PayPay風）</h2>
                            <p className="text-gray-500 mb-6">ワーカー向けページで使用するカラーとコンポーネント。</p>

                            {/* カラーパレット */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">カラーパレット</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-primary flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#FF3333</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">primary</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-primary-dark flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#E62E2E</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">primary-dark</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-primary-light flex items-center justify-center border border-gray-200">
                                            <span className="text-gray-900 text-xs font-medium">#FFE5E5</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">primary-light</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-secondary flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#3895FF</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">secondary</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-secondary-dark flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#2D7AD9</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">secondary-dark</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-secondary-light flex items-center justify-center border border-gray-200">
                                            <span className="text-gray-900 text-xs font-medium">#E5F2FF</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">secondary-light</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-card bg-background flex items-center justify-center border border-gray-200">
                                            <span className="text-gray-900 text-xs font-medium">#F7F7F7</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">background</p>
                                    </div>
                                </div>
                            </div>

                            {/* ボタン */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">ボタン</h3>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <button className="px-6 py-3 bg-primary text-white rounded-button font-medium shadow-primary hover:bg-primary-dark transition-all">
                                        プライマリボタン
                                    </button>
                                    <button className="px-6 py-3 bg-secondary text-white rounded-button font-medium shadow-secondary hover:bg-secondary-dark transition-all">
                                        セカンダリボタン
                                    </button>
                                    <button className="px-6 py-3 bg-white text-primary border-[1.5px] border-primary rounded-button font-medium hover:bg-primary-light transition-all">
                                        アウトラインボタン
                                    </button>
                                    <button className="px-6 py-3 text-gray-600 rounded-button font-medium hover:bg-gray-100 transition-all">
                                        ゴーストボタン
                                    </button>
                                </div>
                            </div>

                            {/* カード */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">カード</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-surface rounded-card p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer">
                                        <h4 className="font-bold text-gray-900 mb-2">求人カード</h4>
                                        <p className="text-sm text-gray-600 mb-2">角丸16px、シャドウ付き、ホバー時に浮き上がる効果</p>
                                        <p className="text-lg font-bold text-primary">¥1,500/時</p>
                                    </div>
                                    <div className="bg-background rounded-card p-4">
                                        <h4 className="font-bold text-gray-900 mb-2">情報カード</h4>
                                        <p className="text-sm text-gray-600">背景 #F7F7F7、角丸12px</p>
                                    </div>
                                </div>
                            </div>

                            {/* バッジ */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">ステータスバッジ</h3>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 bg-secondary-light text-secondary rounded-badge text-sm font-medium">募集中</span>
                                    <span className="px-3 py-1 bg-primary-light text-primary rounded-badge text-sm font-medium">締切間近</span>
                                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-badge text-sm font-medium">完了</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Admin Section */}
                {activeTab === 'admin' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">管理者向けデザイン（プロフェッショナル）</h2>
                            <p className="text-gray-500 mb-6">管理者向けページで使用するカラーとコンポーネント。</p>

                            {/* カラーパレット */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">カラーパレット</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-admin-card bg-admin-primary flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#2563EB</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-admin-card bg-admin-primary-dark flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#1D4ED8</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary-dark</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-admin-card bg-admin-primary-light flex items-center justify-center border border-gray-200">
                                            <span className="text-gray-900 text-xs font-medium">#DBEAFE</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary-light</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-20 rounded-admin-card bg-admin-sidebar flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">#111827</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 text-center">admin-sidebar</p>
                                    </div>
                                </div>
                            </div>

                            {/* ボタン */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">ボタン</h3>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <button className="px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button font-medium hover:bg-admin-primary-dark transition-colors">
                                        求人作成
                                    </button>
                                    <button className="px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button font-medium hover:bg-admin-primary-dark transition-colors">
                                        公開する
                                    </button>
                                    <button className="px-4 py-2 text-sm bg-gray-600 text-white rounded-admin-button font-medium hover:bg-gray-700 transition-colors">
                                        停止する
                                    </button>
                                    <button className="px-4 py-2 text-sm bg-red-600 text-white rounded-admin-button font-medium hover:bg-red-700 transition-colors">
                                        削除する
                                    </button>
                                    <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-admin-button font-medium hover:bg-gray-50 transition-colors">
                                        テンプレート管理
                                    </button>
                                </div>
                            </div>

                            {/* カード */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">カード</h3>
                                <div className="bg-white rounded-admin-card border border-gray-200 hover:border-admin-primary hover:shadow-md transition-all p-4 cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" className="w-4 h-4 text-admin-primary border-gray-300 rounded" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">公開中</span>
                                                <span className="font-medium text-gray-900">介護スタッフ募集</span>
                                            </div>
                                            <p className="text-sm text-gray-600">2025/12/04 10:00〜18:00 • 応募: 3名 • マッチング: 1/2名</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ステータスバッジ（青ベース統一） */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">ステータスバッジ（青ベース統一）</h3>
                                <p className="text-sm text-gray-500 mb-4">管理画面のメインカラー（青）をベースに統一したパターン5を採用</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white">公開中</span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-400">停止中</span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-800 text-white">勤務中</span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-300 text-blue-900">評価待ち</span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-300">完了</span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-600">不成立</span>
                                </div>
                                <div className="text-xs bg-gray-50 p-3 rounded space-y-1">
                                    <p><code className="bg-gray-100 px-1 rounded">公開中</code>: bg-blue-600 text-white</p>
                                    <p><code className="bg-gray-100 px-1 rounded">停止中</code>: bg-blue-100 text-blue-400</p>
                                    <p><code className="bg-gray-100 px-1 rounded">勤務中</code>: bg-blue-800 text-white</p>
                                    <p><code className="bg-gray-100 px-1 rounded">評価待ち</code>: bg-blue-300 text-blue-900</p>
                                    <p><code className="bg-gray-100 px-1 rounded">完了</code>: bg-blue-50 text-blue-300</p>
                                    <p><code className="bg-gray-100 px-1 rounded">不成立</code>: bg-red-100 text-red-600</p>
                                </div>
                            </div>

                            {/* フィルターボタン（ドットインジケーター） */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">フィルターボタン（ドットインジケーター）</h3>
                                <p className="text-sm text-gray-500 mb-4">求人一覧・応募管理・ワーカー一覧のフィルターに使用</p>

                                {/* すべてボタン */}
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">「すべて」ボタン（ドットなし・青）</h4>
                                    <div className="flex gap-2 mb-2">
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-admin-primary text-white">
                                            すべて（選択時）
                                        </button>
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                                            すべて（非選択時）
                                        </button>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-1">選択時: bg-admin-primary text-white</code>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">非選択時: bg-gray-100 text-gray-700 hover:bg-gray-200</code>
                                </div>

                                {/* ドット付きフィルターボタン */}
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">ステータスフィルター（ドットインジケーター付き）</h4>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 text-gray-900 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>公開中（選択時）
                                        </button>
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>公開中（非選択時）
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>停止中
                                        </button>
                                        <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>完了
                                        </button>
                                    </div>
                                    <div className="text-xs bg-gray-50 p-3 rounded space-y-1">
                                        <p><code className="bg-gray-100 px-1 rounded">選択時</code>: bg-gray-200 text-gray-900</p>
                                        <p><code className="bg-gray-100 px-1 rounded">非選択時</code>: bg-gray-100 text-gray-700 hover:bg-gray-200</p>
                                        <p><code className="bg-gray-100 px-1 rounded">公開中ドット</code>: bg-green-500</p>
                                        <p><code className="bg-gray-100 px-1 rounded">停止中・完了ドット</code>: bg-gray-400</p>
                                    </div>
                                </div>
                            </div>

                            {/* サイドバーサンプル */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">サイドバーサンプル</h3>
                                <div className="bg-admin-sidebar rounded-lg p-4 w-60">
                                    <div className="space-y-1">
                                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-blue-400 bg-blue-500/20 text-sm">
                                            <span>📊</span>
                                            <span>ダッシュボード</span>
                                        </a>
                                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                                            <span>📋</span>
                                            <span>求人管理</span>
                                        </a>
                                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                                            <span>👥</span>
                                            <span>応募管理</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Tag Styles Section */}
                {activeTab === 'tag-styles' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">タグスタイル一覧</h2>
                            <p className="text-gray-500 mb-6">仕事内容・資格・経験などのタグに使用するスタイル。ステータスバッジとは異なり、情報分類用のタグです。</p>

                            {/* ワーカー画面のタグ */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">ワーカー画面のタグ</h3>

                                {/* 仕事内容タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">仕事内容タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: JobDetailClient.tsx, jobs/page.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">食事介助</span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">排泄介助</span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">入浴介助</span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">レクリエーション</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-gray-100 text-gray-600 text-xs rounded</code>
                                </div>

                                {/* 資格タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">資格タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: Tag component, applications/page.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded">介護福祉士</span>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded">看護師</span>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded">准看護師</span>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded">初任者研修</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-blue-50 text-blue-700 border border-blue-200</code>
                                </div>

                                {/* 特徴タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">特徴タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: JobDetailClient.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">入浴介助なし</span>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">送迎ドライバーあり</span>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">髪型・髪色自由</span>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">未経験歓迎</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-green-100 text-green-800</code>
                                </div>

                                {/* 募集条件タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">募集条件タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: JobDetailClient.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">週3回以上</span>
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">月10日以上</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-1">週頻度: bg-orange-100 text-orange-700</code>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">月コミット: bg-purple-100 text-purple-700</code>
                                </div>
                            </div>

                            {/* 管理画面のタグ */}
                            <div className="bg-white rounded-lg shadow p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">管理画面のタグ</h3>

                                {/* 仕事内容タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">仕事内容タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: applications/page.tsx, jobs/page.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">食事介助</span>
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">排泄介助</span>
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">見守り</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-gray-100 text-gray-600</code>
                                </div>

                                {/* 資格タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">資格タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: applications/page.tsx, workers/[id]/page.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">介護福祉士</span>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">看護師</span>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">初任者研修</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-blue-50 text-blue-700</code>
                                </div>

                                {/* 経験分野タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">経験分野タグ（色分け）</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: workers/[id]/page.tsx - getExperienceColor関数で分野別に色を割り当て</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">特養</span>
                                        <span className="px-2 py-1 bg-indigo-600 text-white text-xs rounded">老健</span>
                                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">グループホーム</span>
                                        <span className="px-2 py-1 bg-pink-600 text-white text-xs rounded">有料老人ホーム</span>
                                        <span className="px-2 py-1 bg-teal-600 text-white text-xs rounded">デイサービス</span>
                                        <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">訪問介護</span>
                                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">病院</span>
                                        <span className="px-2 py-1 bg-cyan-600 text-white text-xs rounded">クリニック</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">分野別に bg-{'{color}'}-600 text-white を使用</code>
                                </div>

                                {/* 移動手段タグ */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">移動手段タグ</h4>
                                    <p className="text-xs text-gray-500 mb-3">使用箇所: jobs/page.tsx</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">車</span>
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">バイク</span>
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">自転車</span>
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">公共交通機関</span>
                                    </div>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">bg-gray-100 text-gray-700</code>
                                </div>
                            </div>

                            {/* タグとステータスバッジの違い */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">タグとステータスバッジの違い</h4>
                                <ul className="text-xs text-blue-700 space-y-1">
                                    <li>• <strong>タグ</strong>: 情報の分類・カテゴリ表示用（仕事内容、資格、経験、特徴など）</li>
                                    <li>• <strong>ステータスバッジ</strong>: 状態を示すインジケーター（公開中、停止中、勤務中など）- 青ベース統一パターンを使用</li>
                                    <li>• <strong>フィルターボタン</strong>: 一覧の絞り込み用 - ドットインジケーターを使用（「すべて」のみ青ボタン）</li>
                                    <li>• タグは静的な情報、ステータスバッジは動的な状態を表現</li>
                                </ul>
                            </div>

                        </div>
                    </section>
                )}

                {/* Colors Section */}
                {activeTab === 'colors' && (
                    <section className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">カラーパレット</h2>
                            <p className="text-gray-500 mb-6">コードベースから抽出された色。</p>

                            <div className="space-y-6">
                                {/* Primary Colors */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">プライマリーカラー（ワーカー向け）</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <ColorCard name="primary" class="bg-primary" hex="#FF3333" text="text-white" />
                                        <ColorCard name="primary-dark" class="bg-primary-dark" hex="#E62E2E" text="text-white" />
                                        <ColorCard name="primary-light" class="bg-primary-light" hex="#FFE5E5" border />
                                        <ColorCard name="secondary" class="bg-secondary" hex="#3895FF" text="text-white" />
                                        <ColorCard name="secondary-dark" class="bg-secondary-dark" hex="#2D7AD9" text="text-white" />
                                        <ColorCard name="secondary-light" class="bg-secondary-light" hex="#E5F2FF" border />
                                    </div>
                                </div>

                                {/* Admin Colors */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">管理者向けカラー</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <ColorCard name="admin-primary" class="bg-admin-primary" hex="#2563EB" text="text-white" />
                                        <ColorCard name="admin-primary-dark" class="bg-admin-primary-dark" hex="#1D4ED8" text="text-white" />
                                        <ColorCard name="admin-primary-light" class="bg-admin-primary-light" hex="#DBEAFE" border />
                                        <ColorCard name="admin-sidebar" class="bg-admin-sidebar" hex="#111827" text="text-white" />
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
