'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFacilityStaffName } from '@/src/lib/actions';
import toast from 'react-hot-toast';
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
  AlertTriangle,
  Lock,
  Trash2,
  KeyRound,
  Shield,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, adminLogout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 仮登録状態をチェック（localStorage から取得）
  const [isPending, setIsPending] = useState(false);
  // マスカレード状態をチェック
  const [isMasquerade, setIsMasquerade] = useState(false);
  // 担当者名（DBから取得）
  const [staffName, setStaffName] = useState<string | null>(null);

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

  // 担当者名を取得
  useEffect(() => {
    const fetchStaffName = async () => {
      if (admin?.facilityId) {
        const name = await getFacilityStaffName(admin.facilityId);
        setStaffName(name);
      }
    };
    fetchStaffName();
  }, [admin?.facilityId]);

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

  const menuItems = [
    {
      title: '求人管理',
      icon: <Briefcase className="w-4 h-4" />,
      href: '/admin/jobs',
      active: pathname === '/admin/jobs' || (pathname?.startsWith('/admin/jobs') && !pathname?.startsWith('/admin/jobs/templates')),
    },
    {
      title: 'テンプレート管理',
      icon: <FileText className="w-4 h-4" />,
      href: '/admin/jobs/templates',
      active: pathname?.startsWith('/admin/jobs/templates'),
      isSubItem: true,
    },
    {
      title: '応募管理',
      icon: <UserCheck className="w-4 h-4" />,
      href: '/admin/applications',
      active: pathname?.startsWith('/admin/applications'),
    },
    {
      title: 'ワーカー管理',
      icon: <Users className="w-4 h-4" />,
      href: '/admin/workers',
      active: pathname?.startsWith('/admin/workers') && !pathname?.startsWith('/admin/worker-reviews'),
    },
    {
      title: 'ワーカーレビュー',
      icon: <Star className="w-4 h-4" />,
      href: '/admin/worker-reviews',
      active: pathname?.startsWith('/admin/worker-reviews'),
      isSubItem: true,
    },
    {
      title: 'メッセージ',
      icon: <MessageCircle className="w-4 h-4" />,
      href: '/admin/messages',
      active: pathname === '/admin/messages',
    },
    {
      title: '施設管理',
      icon: <Building2 className="w-4 h-4" />,
      href: '/admin/facility',
      active: pathname === '/admin/facility',
    },
    {
      title: '施設レビュー',
      icon: <Star className="w-4 h-4" />,
      href: '/admin/reviews',
      active: pathname === '/admin/reviews',
    },
    {
      title: 'ご利用ガイド・FAQ',
      icon: <HelpCircle className="w-4 h-4" />,
      href: '/admin/guide',
      active: pathname === '/admin/guide',
      divider: true,
    },
    {
      title: '問い合わせ',
      icon: <MessageSquare className="w-4 h-4" />,
      href: '/admin/contact',
      active: pathname === '/admin/contact',
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <div className="w-64 bg-admin-sidebar border-r border-gray-800 flex flex-col">
        {/* ロゴ・施設名 */}
        <div className="p-4 border-b border-gray-800">
          <Link href="/admin" className="block">
            <h1 className="text-lg font-bold text-white mb-1">S WORKS</h1>
            <p className="text-xs text-gray-400">施設管理画面</p>
          </Link>
        </div>

        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* 仮登録状態の警告バナー */}
          {isPending && (
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
          {menuItems.map((item, index) => {
            // 仮登録状態では施設管理以外は無効化
            const isDisabled = isPending && item.href !== '/admin/facility';

            return (
              <div key={index}>
                {item.divider && <div className="my-2 border-t border-gray-800"></div>}
                {isDisabled ? (
                  // 無効状態（クリック不可）
                  <div
                    className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm ${item.isSubItem ? 'pl-8 pr-4' : 'px-4'
                      } text-gray-600 cursor-not-allowed`}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    <Lock className="w-3 h-3 ml-auto" />
                  </div>
                ) : (
                  // 通常状態（クリック可能）
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors ${item.isSubItem ? 'pl-8 pr-4' : 'px-4'
                      } ${item.active
                        ? 'bg-blue-500/20 text-blue-400 font-medium'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* マスカレード時のみ表示される管理メニュー */}
          {isMasquerade && (
            <>
              <div className="my-2 border-t border-gray-800"></div>
              <div className="mx-2 mb-2 px-2">
                <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wide">
                  <Shield className="w-3 h-3" />
                  システム管理者メニュー
                </div>
              </div>
              <Link
                href="/admin/masquerade-actions/delete-facility"
                className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors px-4 ${
                  pathname === '/admin/masquerade-actions/delete-facility'
                    ? 'bg-red-500/20 text-red-400 font-medium'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>施設削除</span>
              </Link>
              <Link
                href="/admin/masquerade-actions/password-reset"
                className={`flex items-center gap-3 py-2.5 mx-2 rounded-admin-button text-sm transition-colors px-4 ${
                  pathname === '/admin/masquerade-actions/password-reset'
                    ? 'bg-blue-500/20 text-blue-400 font-medium'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>パスワードリセット</span>
              </Link>
            </>
          )}
        </nav>

        {/* ユーザー情報・ログアウト */}
        <div className="p-4 border-t border-gray-800">
          <div className="mb-3">
            {isMasquerade ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1">
                  <Shield className="w-3 h-3" />
                  システム管理者としてログイン中
                </div>
                <p className="text-sm font-medium text-white">システム管理者</p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-1">ログイン中</p>
                <p className="text-sm font-medium text-white">{staffName || admin?.name || '担当者'}</p>
              </>
            )}
          </div>
          <div className="mb-3 flex items-center justify-center gap-3 text-xs text-gray-500">
            <Link href="/admin/terms" className="hover:text-blue-400 hover:underline">
              利用規約
            </Link>
            <span>•</span>
            <Link href="/admin/privacy" className="hover:text-blue-400 hover:underline">
              プライバシーポリシー
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-admin-button hover:bg-white/5 hover:text-white transition-colors"
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
