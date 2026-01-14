'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import { Session } from 'next-auth';
import { FacilityAdmin } from '@/types/admin';
import { authenticateFacilityAdmin, logoutFacilityAdmin } from '@/src/lib/actions';
import {
  createAdminSession,
  getAdminSession,
  clearAdminSession,
  extendAdminSession,
  getSessionRemainingMinutes,
} from '@/lib/admin-session';
import { ADMIN_AUTH_ERROR_EVENT, AdminAuthErrorDetail } from '@/lib/admin-api-fetcher';

interface AuthContextType {
  // ワーカー認証（NextAuth）
  user: Session['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // 施設管理者認証（改善版）
  admin: FacilityAdmin | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => Promise<void>;
  // セッション管理
  sessionRemainingMinutes: number;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthContextProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  // 施設管理者の状態
  const [admin, setAdmin] = useState<FacilityAdmin | null>(null);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(0);

  // セッション状態を復元
  useEffect(() => {
    const restoreSession = () => {
      console.log('[AuthContext] restoreSession started');
      const sessionData = getAdminSession();

      if (sessionData) {
        console.log('[AuthContext] Session found in localStorage (secure)');
        const adminData = {
          id: sessionData.adminId,
          email: sessionData.email,
          password: '', // パスワードは保存しない
          facilityId: sessionData.facilityId,
          name: sessionData.name,
          phone: '',
          role: sessionData.role as 'admin',
        };
        setAdmin(adminData);
        setSessionRemainingMinutes(getSessionRemainingMinutes());
      } else {
        console.log('[AuthContext] No secure session found, checking legacy');
        // 互換性のためlocalStorageもチェック
        const storedAdmin = localStorage.getItem('currentAdmin');
        if (storedAdmin) {
          try {
            const parsed = JSON.parse(storedAdmin);
            // 旧形式のデータを新形式に移行
            createAdminSession({
              adminId: parsed.id,
              facilityId: parsed.facilityId,
              name: parsed.name,
              email: parsed.email,
              role: parsed.role || 'admin',
            });
            setAdmin(parsed);
          } catch {
            localStorage.removeItem('currentAdmin');
          }
        }
      }
      console.log('[AuthContext] restoreSession completed, setting adminLoaded to true');
      setAdminLoaded(true);
    };

    restoreSession();
  }, []); // 初回マウント時のみ実行

  // セッション有効期限を定期的にチェック（1分ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getSessionRemainingMinutes();
      setSessionRemainingMinutes(remaining);

      // セッション切れの場合はログアウト
      if (remaining === 0) {
        const currentSession = getAdminSession();
        if (!currentSession) {
          setAdmin(null);
          clearAdminSession();
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ユーザーアクティビティを監視してセッションを延長
  useEffect(() => {
    if (!admin) return;

    const handleActivity = () => {
      extendAdminSession();
      setSessionRemainingMinutes(getSessionRemainingMinutes());
    };

    // クリックやキー入力でセッションを延長
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [admin]);

  // ワーカーログイン
  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] login started', { email });
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      console.log('[AuthContext] signIn result:', result);

      // result.ok が false の場合も失敗として扱う
      if (!result?.ok || result?.error) {
        console.log('[AuthContext] login failed:', result?.error);
        return { success: false, error: result?.error || 'ログインに失敗しました' };
      }

      console.log('[AuthContext] login success');
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] login error:', error);
      return { success: false, error: 'ログイン中にエラーが発生しました' };
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
  };

  // 施設管理者ログイン（改善版）
  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authenticateFacilityAdmin(email, password);

      if (result.success && result.admin) {
        // セキュアなセッションを作成
        createAdminSession({
          adminId: result.admin.id,
          facilityId: result.admin.facilityId,
          name: result.admin.name,
          email: result.admin.email,
          role: 'admin',
        });

        const adminData: FacilityAdmin = {
          id: result.admin.id,
          email: result.admin.email,
          password: '', // パスワードは保存しない
          facilityId: result.admin.facilityId,
          name: result.admin.name,
          phone: result.admin.phone,
          role: 'admin',
        };
        setAdmin(adminData);
        setSessionRemainingMinutes(getSessionRemainingMinutes());
        return { success: true };
      }

      return { success: false, error: result.error || 'ログインに失敗しました' };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, error: 'ログイン中にエラーが発生しました' };
    }
  };

  const adminLogout = useCallback(async () => {
    // クライアント側の状態をクリア
    setAdmin(null);
    clearAdminSession();

    // サーバー側のセッションもクリア（エラーは無視）
    try {
      await logoutFacilityAdmin();
    } catch (error) {
      console.error('[AuthContext] Server logout failed:', error);
      // クライアント側は既にクリアしているので、エラーは無視
    }
  }, []);

  const extendSession = useCallback(() => {
    extendAdminSession();
    setSessionRemainingMinutes(getSessionRemainingMinutes());
  }, []);

  // 認証エラーイベントをリッスン（API呼び出しで401/403が返された場合）
  useEffect(() => {
    const handleAuthError = async (event: Event) => {
      const customEvent = event as CustomEvent<AdminAuthErrorDetail>;
      console.log('[AuthContext] Auth error received:', customEvent.detail);

      if (customEvent.detail.code === 'UNAUTHORIZED') {
        // 未認証：セッション切れまたは無効なセッション
        console.log('[AuthContext] Session expired or invalid, logging out...');
        await adminLogout();
        // ログインページへリダイレクト
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login?expired=true';
        }
      } else if (customEvent.detail.code === 'FORBIDDEN') {
        // 権限なし：他施設のデータにアクセスしようとした
        console.log('[AuthContext] Access forbidden');
        // アラートを表示してダッシュボードへリダイレクト
        if (typeof window !== 'undefined') {
          alert('アクセス権限がありません');
          window.location.href = '/admin/dashboard';
        }
      }
    };

    window.addEventListener(ADMIN_AUTH_ERROR_EVENT, handleAuthError);
    return () => {
      window.removeEventListener(ADMIN_AUTH_ERROR_EVENT, handleAuthError);
    };
  }, [adminLogout]);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
        isLoading,
        login,
        logout,
        admin,
        isAdmin: !!admin,
        isAdminLoading: !adminLoaded,
        adminLogin,
        adminLogout,
        sessionRemainingMinutes,
        extendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
