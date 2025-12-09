'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import toast from 'react-hot-toast';
import {
    LayoutDashboard,
    Users,
    Building2,
    Briefcase,
    Settings,
    LogOut,
    Shield,
    FileEdit,
    BarChart3,
    Megaphone, // Added based on instruction
    Search, // Added based on instruction
} from 'lucide-react';

interface SystemAdminLayoutProps {
    children: ReactNode;
}

export default function SystemAdminLayout({ children }: SystemAdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { admin, adminLogout } = useSystemAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        adminLogout();
        setShowLogoutConfirm(false);
        toast.success('ログアウトしました');
        router.push('/system-admin/login');
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    const menuItems = [
        {
            title: 'ダッシュボード',
            icon: <LayoutDashboard className="w-4 h-4" />,
            href: '/system-admin',
            active: pathname === '/system-admin',
        },
        {
            title: 'アナリティクス',
            icon: <BarChart3 className="w-4 h-4" />,
            href: '/system-admin/analytics',
            active: pathname?.startsWith('/system-admin/analytics'),
        },
        {
            title: 'ワーカー管理',
            icon: <Users className="w-4 h-4" />,
            href: '/system-admin/workers',
            active: pathname?.startsWith('/system-admin/workers'),
        },
        {
            title: '施設管理',
            icon: <Building2 className="w-4 h-4" />,
            href: '/system-admin/facilities',
            active: pathname?.startsWith('/system-admin/facilities'),
        },
        {
            title: '求人管理',
            icon: <Briefcase className="w-4 h-4" />,
            href: '/system-admin/jobs',
            active: pathname?.startsWith('/system-admin/jobs'),
        },

        {
            title: 'コンテンツ管理',
            icon: <FileEdit className="w-4 h-4" />,
            href: '/system-admin/content',
            active: pathname?.startsWith('/system-admin/content'),
        },
        {
            title: 'システム設定',
            icon: <Settings className="w-4 h-4" />,
            href: '/system-admin/settings',
            active: pathname?.startsWith('/system-admin/settings'),
            divider: true,
        },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* サイドバー */}
            <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
                {/* ロゴ・管理者 */}
                <div className="p-4 border-b border-slate-800">
                    <Link href="/system-admin" className="block">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-5 h-5 text-indigo-500" />
                            <h1 className="text-lg font-bold text-white">S WORKS System</h1>
                        </div>
                        <p className="text-xs text-slate-500 pl-7">システム管理画面</p>
                    </Link>
                </div>

                {/* メニュー */}
                <nav className="flex-1 overflow-y-auto py-4">
                    {menuItems.map((item, index) => (
                        <div key={index}>
                            {item.divider && <div className="my-2 border-t border-slate-800"></div>}
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 py-2.5 mx-2 rounded-lg text-sm transition-colors px-4 ${item.active
                                    ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                                    : 'hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </Link>
                        </div>
                    ))}
                </nav>

                {/* ユーザー情報・ログアウト */}
                <div className="p-4 border-t border-slate-800">
                    <div className="mb-3">
                        <p className="text-xs text-slate-500 mb-1">ログイン中</p>
                        <p className="text-sm font-medium text-white">{admin?.name || '管理者'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        ログアウト
                    </button>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>

            {/* ログアウト確認モーダル */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={cancelLogout}></div>
                    <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">ログアウト</h3>
                        <p className="text-gray-600 mb-6">ログアウトしますか？</p>
                        <div className="flex gap-3">
                            <button
                                onClick={cancelLogout}
                                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
