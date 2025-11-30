'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, adminLogout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
      active: pathname?.startsWith('/admin/workers'),
    },
    {
      title: 'メッセージ',
      icon: <MessageCircle className="w-4 h-4" />,
      href: '/admin/messages',
      active: pathname === '/admin/messages',
    },
    {
      title: '法人・施設',
      icon: <Building2 className="w-4 h-4" />,
      href: '/admin/facility',
      active: pathname === '/admin/facility',
    },
    {
      title: 'レビュー',
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
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* ロゴ・施設名 */}
        <div className="p-4 border-b border-gray-200">
          <Link href="/admin" className="block">
            <h1 className="text-lg font-bold text-blue-600 mb-1">S WORKS</h1>
            <p className="text-xs text-gray-600">施設管理画面</p>
          </Link>
        </div>

        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.divider && <div className="my-2 border-t border-gray-200"></div>}
              <Link
                href={item.href}
                className={`flex items-center gap-3 py-2.5 text-sm transition-colors ${
                  item.isSubItem ? 'pl-8 pr-4' : 'px-4'
                } ${
                  item.active
                    ? 'bg-blue-50 text-blue-600 font-medium border-r-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </div>
          ))}
        </nav>

        {/* ユーザー情報・ログアウト */}
        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">ログイン中</p>
            <p className="text-sm font-medium text-gray-900">{admin?.name}</p>
          </div>
          <div className="mb-3 flex items-center justify-center gap-3 text-xs text-gray-600">
            <Link href="/admin/terms" className="hover:text-blue-600 hover:underline">
              利用規約
            </Link>
            <span>•</span>
            <Link href="/admin/privacy" className="hover:text-blue-600 hover:underline">
              プライバシーポリシー
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
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
