'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import { Session } from 'next-auth';
import { FacilityAdmin } from '@/types/admin';
import { authenticateFacilityAdmin } from '@/src/lib/actions';

interface AuthContextType {
  // ワーカー認証（NextAuth）
  user: Session['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // 施設管理者認証（DBベース）
  admin: FacilityAdmin | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthContextProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  // 施設管理者の状態（従来の方式を維持）
  const [admin, setAdmin] = useState<FacilityAdmin | null>(null);
  const [adminLoaded, setAdminLoaded] = useState(false);

  // ページ読み込み時にlocalStorageから管理者情報を復元
  useEffect(() => {
    const storedAdmin = localStorage.getItem('currentAdmin');
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }
    setAdminLoaded(true);
  }, []);

  // ワーカーログイン
  const login = async (email: string, password: string) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'ログイン中にエラーが発生しました' };
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
  };

  // 施設管理者ログイン（DBベース）
  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authenticateFacilityAdmin(email, password);

      if (result.success && result.admin) {
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
        localStorage.setItem('currentAdmin', JSON.stringify(adminData));
        return { success: true };
      }

      return { success: false, error: result.error || 'ログインに失敗しました' };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, error: 'ログイン中にエラーが発生しました' };
    }
  };

  const adminLogout = () => {
    setAdmin(null);
    localStorage.removeItem('currentAdmin');
  };



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
