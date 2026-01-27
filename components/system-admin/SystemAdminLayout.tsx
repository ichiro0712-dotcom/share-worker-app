'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import toast from 'react-hot-toast';
import { DebugErrorProvider } from '@/components/debug/DebugErrorBanner';
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
    Code2,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileSpreadsheet,
} from 'lucide-react';

interface SystemAdminLayoutProps {
    children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'system_admin_sidebar_collapsed';

export default function SystemAdminLayout({ children }: SystemAdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { admin, adminLogout } = useSystemAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // サイドバー折りたたみ状態
    const [isCollapsed, setIsCollapsed] = useState(false);

    // 折りたたみ状態をlocalStorageから復元
    useEffect(() => {
        const savedState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        if (savedState !== null) {
            setIsCollapsed(savedState === 'true');
        }
    }, []);

    // 折りたたみ状態をlocalStorageに保存
    const toggleCollapsed = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
    };

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
            icon: <LayoutDashboard className="w-5 h-5" />,
            href: '/system-admin',
            active: pathname === '/system-admin',
        },
        {
            title: 'アナリティクス',
            icon: <BarChart3 className="w-5 h-5" />,
            href: '/system-admin/analytics',
            active: pathname?.startsWith('/system-admin/analytics'),
        },
        {
            title: 'ワーカー管理',
            icon: <Users className="w-5 h-5" />,
            href: '/system-admin/workers',
            active: pathname?.startsWith('/system-admin/workers'),
        },
        {
            title: '施設管理',
            icon: <Building2 className="w-5 h-5" />,
            href: '/system-admin/facilities',
            active: pathname?.startsWith('/system-admin/facilities'),
        },
        {
            title: '求人管理',
            icon: <Briefcase className="w-5 h-5" />,
            href: '/system-admin/jobs',
            active: pathname?.startsWith('/system-admin/jobs'),
        },
        {
            title: '勤怠管理',
            icon: <Clock className="w-5 h-5" />,
            href: '/system-admin/attendance',
            active: pathname?.startsWith('/system-admin/attendance'),
        },
        {
            title: 'CSV出力',
            icon: <FileSpreadsheet className="w-5 h-5" />,
            href: '/system-admin/csv-export',
            active: pathname?.startsWith('/system-admin/csv-export'),
        },
        {
            title: 'コンテンツ管理',
            icon: <FileEdit className="w-5 h-5" />,
            href: '/system-admin/content',
            active: pathname?.startsWith('/system-admin/content'),
        },
        {
            title: 'システム設定',
            icon: <Settings className="w-5 h-5" />,
            href: '/system-admin/settings/system',
            active: pathname?.startsWith('/system-admin/settings'),
            divider: true,
        },
        {
            title: '開発ポータル',
            icon: <Code2 className="w-5 h-5" />,
            href: '/system-admin/dev-portal',
            active: pathname?.startsWith('/system-admin/dev-portal'),
        },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* サイドバー */}
            <div
                className={`bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'
                    }`}
            >
                {/* ロゴ・管理者 */}
                <div className="p-3 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <Link href="/system-admin" className="flex items-center gap-2 flex-1 min-w-0">
                            <Shield className={`text-indigo-500 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                            {!isCollapsed && (
                                <div className="overflow-hidden">
                                    <h1 className="text-lg font-bold text-white whitespace-nowrap">+TASTAS System</h1>
                                    <p className="text-xs text-slate-500 whitespace-nowrap">システム管理画面</p>
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={toggleCollapsed}
                            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title={isCollapsed ? 'メニューを展開' : 'メニューを折りたたむ'}
                        >
                            {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronLeft className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* メニュー */}
                <nav className="flex-1 overflow-y-auto py-4">
                    {menuItems.map((item, index) => (
                        <div key={index}>
                            {item.divider && <div className="my-2 border-t border-slate-800"></div>}
                            {isCollapsed ? (
                                <Link
                                    href={item.href}
                                    className={`relative flex items-center justify-center py-2.5 mx-2 rounded-lg transition-colors group ${item.active
                                        ? 'bg-indigo-500/20 text-indigo-400'
                                        : 'hover:text-white hover:bg-white/5'
                                        }`}
                                    title={item.title}
                                >
                                    {item.icon}
                                    {/* ツールチップ */}
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        {item.title}
                                    </div>
                                </Link>
                            ) : (
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
                            )}
                        </div>
                    ))}
                </nav>

                {/* ユーザー情報・ログアウト */}
                <div className={`border-t border-slate-800 ${isCollapsed ? 'p-2' : 'p-4'}`}>
                    {!isCollapsed && (
                        <div className="mb-3">
                            <p className="text-xs text-slate-500 mb-1">ログイン中</p>
                            <p className="text-sm font-medium text-white">{admin?.name || '管理者'}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center justify-center gap-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-white/5 hover:text-white transition-colors ${isCollapsed ? 'p-2' : 'px-4 py-2'
                            }`}
                        title={isCollapsed ? 'ログアウト' : undefined}
                    >
                        <LogOut className="w-5 h-5" />
                        {!isCollapsed && <span>ログアウト</span>}
                    </button>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="flex-1 overflow-y-auto">
                <DebugErrorProvider>
                    {children}
                </DebugErrorProvider>
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
