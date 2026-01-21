'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFacilityStaffName, getFacilitySidebarBadges, getFacilityInfo } from '@/src/lib/actions';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
  Briefcase,
  Users,
  Building2,
  HelpCircle,
  MessageSquare,
  LogOut,
  Star,
  FileText,
  MessageCircle,
  UserCheck,
  Calendar,
  AlertTriangle,
  Lock,
  Trash2,
  KeyRound,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  QrCode,
  ClipboardCheck,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, adminLogout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // サイドバー折りたたみ状態
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 仮登録状態をチェック（localStorage から取得）
  const [isPending, setIsPending] = useState(false);
  // マスカレード状態をチェック
  const [isMasquerade, setIsMasquerade] = useState(false);
  // 担当者名（DBから取得）
  const [staffName, setStaffName] = useState<string | null>(null);
  // 施設名（DBから取得）
  const [facilityName, setFacilityName] = useState<string | null>(null);
  // 通知バッジ用
  const [badges, setBadges] = useState({
    unreadMessages: 0,
    pendingApplications: 0,
    unreadAnnouncements: 0,
    pendingReviews: 0,
    pendingAttendanceModifications: 0,
  });

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

  useEffect(() => {
    const checkSessionStatus = () => {
      try {
        const sessionStr = localStorage.getItem('admin_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          setIsPending(session.isPending === true);
          setIsMasquerade(session.isMasquerade === true);
        }
      } catch {
        // ignore
      }
    };
    checkSessionStatus();
  }, []);

  // 担当者名と施設名を取得
  useEffect(() => {
    const fetchFacilityData = async () => {
      if (admin?.facilityId) {
        try {
          // 担当者名を取得
          const name = await getFacilityStaffName(admin.facilityId);
          setStaffName(name);

          // 施設名を取得
          const facilityInfo = await getFacilityInfo(admin.facilityId);
          if (facilityInfo) {
            setFacilityName(facilityInfo.facilityName);
          }
        } catch (error) {
          const debugInfo = extractDebugInfo(error);
          showDebugError({
            type: 'fetch',
            operation: '施設情報取得',
            message: debugInfo.message,
            details: debugInfo.details,
            stack: debugInfo.stack,
            context: { facilityId: admin?.facilityId }
          });
          console.error('Failed to fetch facility data:', error);
        }
      }
    };
    fetchFacilityData();
  }, [admin?.facilityId]);

  // 通知バッジを取得
  const fetchBadges = useCallback(async () => {
    if (admin?.facilityId && !isPending) {
      try {
        const data = await getFacilitySidebarBadges(admin.facilityId);
        setBadges(data);
      } catch (error) {
        const debugInfo = extractDebugInfo(error);
        showDebugError({
          type: 'fetch',
          operation: 'サイドバー通知バッジ取得',
          message: debugInfo.message,
          details: debugInfo.details,
          stack: debugInfo.stack,
          context: { facilityId: admin?.facilityId }
        });
        console.error('Failed to fetch sidebar badges:', error);
      }
    }
  }, [admin?.facilityId, isPending]);

  useEffect(() => {
    fetchBadges();
    // 30秒ごとに更新
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  // ページ遷移時にバッジを更新
  useEffect(() => {
    fetchBadges();
  }, [pathname, fetchBadges]);

  // 仮登録状態で施設管理以外にアクセスしたらリダイレクト
  useEffect(() => {
    if (isPending && pathname && pathname !== '/admin/facility' && !pathname.startsWith('/admin/masquerade')) {
      toast.error('施設情報を登録してください');
      router.push('/admin/facility');
    }
  }, [isPending, pathname, router]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    adminLogout();
    setShowLogoutConfirm(false);
    toast.success('ログアウトしました');
    router.push('/admin/login');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // マスカレード終了処理
  const handleMasqueradeExit = () => {
    // admin_sessionからマスカレード情報をクリア
    localStorage.removeItem('admin_session');
    localStorage.removeItem('currentAdmin');
    toast.success('マスカレードを終了しました');
    router.push('/system-admin/facilities');
  };

  const menuItems = [
    {
      title: '求人管理',
      icon: <Briefcase className="w-5 h-5" />,
      href: '/admin/jobs',
      active: pathname === '/admin/jobs' || (pathname?.startsWith('/admin/jobs') && !pathname?.startsWith('/admin/jobs/templates')),
    },
    {
      title: 'テンプレート管理',
      icon: <FileText className="w-5 h-5" />,
      href: '/admin/jobs/templates',
      active: pathname?.startsWith('/admin/jobs/templates'),
      isSubItem: true,
    },
    {
      title: '応募管理',
      icon: <UserCheck className="w-5 h-5" />,
      href: '/admin/applications',
      active: pathname?.startsWith('/admin/applications'),
      badge: badges.pendingApplications,
    },
    {
      title: 'シフト管理',
      icon: <Calendar className="w-5 h-5" />,
      href: '/admin/shifts',
      active: pathname?.startsWith('/admin/shifts'),
    },
    {
      title: 'ワーカー管理',
      icon: <Users className="w-5 h-5" />,
      href: '/admin/workers',
      active: pathname?.startsWith('/admin/workers') && !pathname?.startsWith('/admin/worker-reviews'),
    },
    {
      title: 'ワーカーレビュ',
      icon: <Star className="w-5 h-5" />,
      href: '/admin/worker-reviews',
      active: pathname?.startsWith('/admin/worker-reviews'),
      isSubItem: true,
      badge: badges.pendingReviews,
    },
    {
      title: 'メッセージ',
      icon: <MessageCircle className="w-5 h-5" />,
      href: '/admin/messages',
      active: pathname === '/admin/messages',
      badge: badges.unreadMessages + badges.unreadAnnouncements,
    },
    {
      title: '施設管理',
      icon: <Building2 className="w-5 h-5" />,
      href: '/admin/facility',
      active: pathname === '/admin/facility',
    },
    {
      title: '施設レビュー',
      icon: <Star className="w-5 h-5" />,
      href: '/admin/reviews',
      active: pathname === '/admin/reviews',
    },
    {
      title: '出退勤QRコード',
      icon: <QrCode className="w-5 h-5" />,
      href: '/admin/attendance',
      active: pathname === '/admin/attendance',
    },
    {
      title: 'タスク',
      icon: <ClipboardCheck className="w-5 h-5" />,
      href: '/admin/tasks/attendance',
      active: pathname?.startsWith('/admin/tasks'),
      badge: badges.pendingAttendanceModifications,
    },
    {
      title: 'ご利用ガイド・FAQ',
      icon: <HelpCircle className="w-5 h-5" />,
      href: '/admin/faq',
      active: pathname === '/admin/faq',
      divider: true,
    },
    {
      title: '問い合わせ',
      icon: <MessageSquare className="w-5 h-5" />,
      href: '/admin/contact',
      active: pathname === '/admin/contact',
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <div
        className={`bg-admin-sidebar border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-56'
          }`}
      >
        {/* ロゴ・施設名 */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <Link
              href="/admin/jobs"
              prefetch={true}
              className="flex items-center gap-3 flex-1 min-w-0"
              title={isCollapsed && facilityName ? facilityName : undefined}
            >
              <Image
                src="/images/logo.png"
                alt="+TASTAS"
                width={isCollapsed ? 32 : 48}
                height={isCollapsed ? 32 : 48}
                className="rounded-lg flex-shrink-0 transition-all duration-300"
              />
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="text-lg font-bold text-white whitespace-nowrap">+TASTAS</h1>
                  <p className="text-xs text-gray-400 whitespace-nowrap">施設管理画面</p>
                  {facilityName && (
                    <p className="text-xs text-blue-400 mt-1 truncate" title={facilityName}>
                      {facilityName}
                    </p>
                  )}
                </div>
              )}
            </Link>
            <button
              onClick={toggleCollapsed}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
          {/* 仮登録状態の警告バナー */}
          {isPending && !isCollapsed && (
            <div className="mx-2 mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                <AlertTriangle className="w-4 h-4" />
                施設情報未登録
              </div>
              <p className="text-amber-300/80 text-xs mt-1">
                施設情報を入力して保存してください
              </p>
            </div>
          )}
          {isPending && isCollapsed && (
            <div className="mx-2 mb-4 flex justify-center">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center" title="施設情報未登録">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          )}
          {menuItems.map((item, index) => {
            // 仮登録状態では施設管理以外は無効化
            const isDisabled = isPending && item.href !== '/admin/facility';

            return (
              <div key={index}>
                {item.divider && <div className="my-2 border-t border-gray-800"></div>}
                {isDisabled ? (
                  // 無効状態（クリック不可）
                  isCollapsed ? (
                    <div
                      className="flex items-center justify-center py-2.5 mx-2 rounded-admin-button text-gray-600 cursor-not-allowed"
                      title={item.title}
                    >
                      {item.icon}
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm ${item.isSubItem ? 'pl-8 pr-4' : 'px-4'
                        } text-gray-600 cursor-not-allowed`}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      <Lock className="w-3 h-3 ml-auto" />
                    </div>
                  )
                ) : (
                  // 通常状態（クリック可能）
                  isCollapsed ? (
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={`relative flex items-center justify-center py-2.5 mx-2 rounded-admin-button transition-colors group ${item.active
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      title={item.title}
                    >
                      {item.icon}
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                      {/* ツールチップ */}
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                        {item.title}
                      </div>
                    </Link>
                  ) : (
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors ${item.isSubItem ? 'pl-8 pr-4' : 'px-4'
                        } ${item.active
                          ? 'bg-blue-500/20 text-blue-400 font-medium'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      {item.icon}
                      <span className="flex-1">{item.title}</span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                      )}
                    </Link>
                  )
                )}
              </div>
            );
          })}

          {/* マスカレード時のみ表示される管理メニュー */}
          {isMasquerade && (
            <>
              <div className="my-2 border-t border-gray-800"></div>
              {!isCollapsed && (
                <div className="mx-2 mb-2 px-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wide">
                    <Shield className="w-3 h-3" />
                    システム管理者メニュー
                  </div>
                </div>
              )}
              {isCollapsed ? (
                <>
                  <Link
                    href="/admin/masquerade-actions/delete-facility"
                    prefetch={true}
                    className={`relative flex items-center justify-center py-2.5 mx-2 rounded-admin-button transition-colors group ${pathname === '/admin/masquerade-actions/delete-facility'
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    title="施設削除"
                  >
                    <Trash2 className="w-5 h-5" />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                      施設削除
                    </div>
                  </Link>
                  <Link
                    href="/admin/masquerade-actions/password-reset"
                    prefetch={true}
                    className={`relative flex items-center justify-center py-2.5 mx-2 rounded-admin-button transition-colors group ${pathname === '/admin/masquerade-actions/password-reset'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    title="パスワードリセット"
                  >
                    <KeyRound className="w-5 h-5" />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                      パスワードリセット
                    </div>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/admin/masquerade-actions/delete-facility"
                    prefetch={true}
                    className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors px-4 ${pathname === '/admin/masquerade-actions/delete-facility'
                      ? 'bg-red-500/20 text-red-400 font-medium'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>施設削除</span>
                  </Link>
                  <Link
                    href="/admin/masquerade-actions/password-reset"
                    prefetch={true}
                    className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors px-4 ${pathname === '/admin/masquerade-actions/password-reset'
                      ? 'bg-blue-500/20 text-blue-400 font-medium'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    <KeyRound className="w-5 h-5" />
                    <span>パスワードリセット</span>
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        {/* ユーザー情報・ログアウト */}
        <div className={`border-t border-gray-800 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {!isCollapsed && (
            <div className="mb-3">
              {isMasquerade ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1">
                    <Shield className="w-3 h-3" />
                    システム管理者としてログイン中
                  </div>
                  <p className="text-sm font-medium text-white">システム管理者</p>
                  {/* マスカレード終了ボタンを追加 */}
                  <button
                    onClick={handleMasqueradeExit}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-purple-300 border border-purple-500/50 rounded-lg hover:bg-purple-500/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    マスカレード終了
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">ログイン中</p>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      ログアウト
                    </button>
                  </div>
                  <p className="text-sm font-medium text-white">{staffName || admin?.name || '担当者'}</p>
                  {facilityName && (
                    <p className="text-xs text-gray-400 mt-1 truncate" title={facilityName}>{facilityName}</p>
                  )}
                </>
              )}
            </div>
          )}
          {!isCollapsed && (
            <div className="mb-3 flex items-center justify-center text-xs text-gray-500">
              <Link href="/admin/terms-privacy" prefetch={true} className="hover:text-blue-400 hover:underline">
                利用規約・プライバシーポリシー
              </Link>
            </div>
          )}
          {/* サイドバー折りたたみ時のみログアウトアイコンボタン表示 */}
          {isCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-white transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
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
