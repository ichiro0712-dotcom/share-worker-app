'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/user';
import { FacilityAdmin } from '@/types/admin';
import { users } from '@/data/users';
import { admins } from '@/data/admins';

interface AuthContextType {
  user: User | FacilityAdmin | null;
  admin: FacilityAdmin | null;
  login: (email: string, password: string) => boolean;
  adminLogin: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | FacilityAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ページ読み込み時にlocalStorageから復元
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // 一般ユーザーログイン
  const login = (email: string, password: string): boolean => {
    const foundUser = users.find(
      (u) => u.email === email && u.password === password
    );

    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('currentUser', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  // 管理者ログイン
  const adminLogin = (email: string, password: string): boolean => {
    const foundAdmin = admins.find(
      (a) => a.email === email && a.password === password
    );

    if (foundAdmin) {
      setUser(foundAdmin);
      localStorage.setItem('currentUser', JSON.stringify(foundAdmin));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  if (isLoading) {
    return null; // または<div>Loading...</div>
  }

  const isAdmin = user !== null && 'role' in user && user.role === 'admin';
  const admin = isAdmin ? (user as FacilityAdmin) : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        login,
        adminLogin,
        logout,
        isAuthenticated: !!user,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
