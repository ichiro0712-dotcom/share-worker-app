'use client';

import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  User as UserIcon,
  Calendar,
  Heart,
  HelpCircle,
  FileText,
  LogOut,
  Star,
  MessageSquare,
  VolumeX,
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuth } from '@/contexts/AuthContext';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
}

export default function MyPage() {
  const router = useRouter();
  const { user: authUser, isAuthenticated, logout } = useAuth();

  // 認証ユーザー情報を使用（未ログイン時はデフォルト値）
  const user = {
    name: authUser?.name || 'ゲストユーザー',
    email: authUser?.email || '',
    profileImage: authUser?.image || null,
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
      router.push('/login');
      router.refresh();
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: <Calendar className="w-5 h-5" />,
      label: '仕事管理',
      href: '/my-jobs',
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'レビュー',
      href: '/mypage/reviews',
    },
    {
      icon: <Heart className="w-5 h-5" />,
      label: 'お気に入り施設',
      href: '/favorites',
    },
    {
      icon: <Star className="w-5 h-5" />,
      label: 'ブックマーク求人',
      href: '/bookmarks',
    },
    {
      icon: <UserIcon className="w-5 h-5" />,
      label: 'プロフィール編集',
      href: '/mypage/profile',
    },
    {
      icon: <HelpCircle className="w-5 h-5" />,
      label: 'ヘルプ・お問い合わせ',
      href: '/help',
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: '利用規約・プライバシーポリシー',
      href: '/terms',
    },
    {
      icon: <VolumeX className="w-5 h-5" />,
      label: 'ミュート施設',
      href: '/mypage/muted-facilities',
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      if (
        item.href.startsWith('/help') ||
        item.href.startsWith('/terms')
      ) {
        // Phase 2で実装予定の機能はプレースホルダーページへ遷移
        router.push('/under-construction?page=' + encodeURIComponent(item.label));
      } else {
        router.push(item.href);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold">マイページ</h1>
        </div>
      </div>

      {/* ユーザー情報カード */}
      <div className="bg-white border-b border-gray-200 p-4 mb-4">
        <button
          onClick={() => router.push('/mypage/profile')}
          className="w-full flex items-center gap-4 text-left hover:bg-gray-50 transition-colors rounded-lg p-2 -m-2"
        >
          {/* プロフィール画像 */}
          <div className="relative w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-8 h-8 text-gray-400" />
            )}
          </div>

          {/* ユーザー情報 */}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg mb-1">{user.name}</h2>
            <p className="text-sm text-gray-600 truncate">{user.email}</p>
            {!isAuthenticated && (
              <p className="text-xs text-orange-600 mt-2">
                ログインするとプロフィールを編集できます
              </p>
            )}
          </div>

          {/* 編集ボタン */}
          <div className="flex-shrink-0">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>

      {/* メニュー */}
      <div className="bg-white border-b border-gray-200">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => handleMenuClick(item)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-600">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.badge && item.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        ))}
      </div>

      {/* ログアウト */}
      <div className="bg-white border-b border-gray-200 mt-4">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-bold">ログアウト</span>
        </button>
      </div>

      {/* バージョン情報 */}
      <div className="text-center py-4 text-xs text-gray-500">
        S WORKS v1.0.0 (Phase 1)
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
