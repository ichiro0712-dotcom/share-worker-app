'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronRight, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSafeImageUrl } from '@/utils/fileValidation';

export function UserCard() {
  const router = useRouter();
  const { user: authUser, isAuthenticated } = useAuth();

  // 認証ユーザー情報を使用（未ログイン時はデフォルト値）
  const user = {
    name: authUser?.name || 'ゲストユーザー',
    email: authUser?.email || '',
    profileImage: getSafeImageUrl(authUser?.image),
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 mb-4">
      <button
        onClick={() => router.push('/mypage/profile')}
        className="w-full flex items-center gap-4 text-left hover:bg-gray-50 transition-colors rounded-lg p-2 -m-2"
      >
        {/* プロフィール画像 */}
        <div className="relative w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
          {user.profileImage ? (
            <Image
              src={user.profileImage}
              alt="Profile"
              fill
              className="object-cover"
            />
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
  );
}

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 mt-4">
      <button
        onClick={handleLogout}
        className="w-full px-4 py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-gray-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span className="text-sm font-bold">ログアウト</span>
      </button>
    </div>
  );
}
