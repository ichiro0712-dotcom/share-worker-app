'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 管理者認証フック
 * セッション復元を待ってから認証状態を判定する
 */
export function useAdminAuth() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();

  useEffect(() => {
    // セッション復元中はリダイレクトしない
    if (isAdminLoading) return;

    // 認証されていない場合はログインページへリダイレクト
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  return {
    admin,
    isAdmin,
    isAdminLoading,
    // 認証確認済み（ローディング完了かつ認証済み）
    isAuthenticated: !isAdminLoading && isAdmin && !!admin,
    // ローディング中（セッション復元中または未認証でリダイレクト待ち）
    isLoading: isAdminLoading || (!isAdmin && !admin),
  };
}
