'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Layout,
    Smartphone,
    Shield,
    ImageIcon,
    Bug,
    BellRing,
    ListChecks,
    Clock,
    Hash,
    Map,
    Book,
    ArrowLeft,
    LucideIcon,
    SendHorizonal,
} from 'lucide-react';

interface MenuItem {
    href: string;
    icon: LucideIcon;
    label: string;
    description: string;
    external?: boolean;
    color?: string;
}

interface MenuSection {
    section: string;
    items: MenuItem[];
}

const menuItems: MenuSection[] = [
    {
        section: 'クイックリンク',
        items: [
            { href: '/style-guide', icon: Layout, label: 'スタイルガイド', description: 'UIコンポーネント', external: true },
            { href: '/dev', icon: Smartphone, label: 'モバイル検証QR', description: '実機テスト用', external: true },
            { href: '/admin/login', icon: Shield, label: '管理者ログイン', description: '施設管理画面', external: true, color: 'green' },
            { href: '/system-admin', icon: Shield, label: 'システム管理', description: '全体管理', external: true, color: 'red' },
        ],
    },
    {
        section: 'デバッグツール',
        items: [
            { href: '/system-admin/dev-portal/logs', icon: Bug, label: 'バグ調査', description: 'エラーログ・操作追跡', color: 'red' },
            { href: '/system-admin/dev-portal/notification-logs', icon: BellRing, label: '通知ログ', description: '送信済み通知', color: 'orange' },
            { href: '/system-admin/dev-portal/test-notifications', icon: SendHorizonal, label: 'テスト通知', description: '通知送信テスト', color: 'green' },
            { href: '/system-admin/dev-portal/debug-checklist', icon: ListChecks, label: 'デバッグ項目', description: '機能検証チェック', color: 'blue' },
            { href: '/system-admin/dev-portal/debug-time', icon: Clock, label: 'デバッグ時刻', description: 'システム時刻変更', color: 'indigo' },
            { href: '/system-admin/dev-portal/sample-images', icon: ImageIcon, label: 'サンプル画像', description: 'モック用素材', color: 'pink' },
        ],
    },
    {
        section: 'ドキュメント',
        items: [
            { href: '/system-admin/dev-portal', icon: Hash, label: 'ダッシュボード', description: 'ポータルトップ' },
            { href: '/system-admin/dev-portal#sitemap', icon: Map, label: 'サイトマップ', description: 'ページ構成' },
            { href: '/system-admin/dev-portal#docs', icon: Book, label: 'ドキュメント', description: 'プロジェクト資料' },
        ],
    },
];

const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:bg-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', hover: 'hover:bg-green-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', hover: 'hover:bg-red-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', hover: 'hover:bg-orange-100' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-600', hover: 'hover:bg-pink-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', hover: 'hover:bg-indigo-100' },
    default: { bg: 'bg-gray-50', text: 'text-gray-600', hover: 'hover:bg-gray-100' },
};

export default function DevPortalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* サイドバー */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
                {/* ヘッダー */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Hash className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">開発ポータル</h1>
                            <p className="text-xs text-gray-500">+タスタス Dev Hub</p>
                        </div>
                    </div>
                </div>

                {/* ナビゲーション */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-6">
                    {menuItems.map((section) => (
                        <div key={section.section}>
                            <h2 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                {section.section}
                            </h2>
                            <ul className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href ||
                                        (item.href !== '/system-admin/dev-portal' && pathname?.startsWith(item.href));
                                    const colors = colorMap[item.color || 'default'];
                                    const Icon = item.icon;

                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                target={item.external ? '_blank' : undefined}
                                                rel={item.external ? 'noopener noreferrer' : undefined}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    isActive
                                                        ? `${colors.bg} ${colors.text} font-medium`
                                                        : `text-gray-700 ${colors.hover}`
                                                }`}
                                            >
                                                <Icon className={`w-4 h-4 ${isActive ? colors.text : 'text-gray-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{item.label}</div>
                                                    <div className="text-xs text-gray-500 truncate">{item.description}</div>
                                                </div>
                                                {item.external && (
                                                    <span className="text-xs text-gray-400">↗</span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* フッター */}
                <div className="p-4 border-t border-gray-200">
                    <Link
                        href="/system-admin"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        システム管理へ戻る
                    </Link>
                </div>
            </aside>

            {/* メインコンテンツ */}
            <main className="flex-1 ml-64">
                {children}
            </main>
        </div>
    );
}
