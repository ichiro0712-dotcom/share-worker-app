'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';

/**
 * セッションデータ型（サーバーから取得）
 */
export interface SystemAdminSessionData {
    adminId: number;
    name: string;
    email: string;
    role: string;
}

interface SystemAuthContextType {
    admin: SystemAdminSessionData | null;
    isAdmin: boolean;
    isAdminLoading: boolean;
    adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    adminLogout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const SystemAuthContext = createContext<SystemAuthContextType | undefined>(undefined);

export function SystemAuthProvider({ children }: { children: ReactNode }) {
    const [admin, setAdmin] = useState<SystemAdminSessionData | null>(null);
    const [adminLoaded, setAdminLoaded] = useState(false);

    // セッション確認（サーバーからCookieベースで取得）
    const checkSession = useCallback(async () => {
        try {
            const response = await fetch('/api/system-admin/auth', {
                method: 'GET',
                credentials: 'include', // Cookieを含める
            });
            const data = await response.json();

            if (data.isLoggedIn && data.admin) {
                setAdmin({
                    adminId: data.admin.id,
                    name: data.admin.name,
                    email: data.admin.email,
                    role: data.admin.role,
                });
            } else {
                setAdmin(null);
            }
        } catch (error) {
            console.error('Session check error:', error);
            setAdmin(null);
        } finally {
            setAdminLoaded(true);
        }
    }, []);

    // 初回マウント時にセッション確認
    useEffect(() => {
        checkSession();
    }, [checkSession]);

    // 定期的なセッション確認（5分ごと）
    useEffect(() => {
        if (!admin) return;

        const interval = setInterval(() => {
            checkSession();
        }, 5 * 60 * 1000); // 5分

        return () => clearInterval(interval);
    }, [admin, checkSession]);

    // ログイン（API経由でCookieを設定）
    const adminLogin = async (email: string, password: string) => {
        try {
            const response = await fetch('/api/system-admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.success && data.admin) {
                setAdmin({
                    adminId: data.admin.id,
                    name: data.admin.name,
                    email: data.admin.email,
                    role: data.admin.role,
                });
                return { success: true };
            }

            return { success: false, error: data.error || 'ログインに失敗しました' };
        } catch (error) {
            console.error('System Admin login error:', error);
            return { success: false, error: 'ログイン中にエラーが発生しました' };
        }
    };

    // ログアウト（API経由でCookieを削除）
    const adminLogout = useCallback(async () => {
        try {
            await fetch('/api/system-admin/auth', {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setAdmin(null);
        }
    }, []);

    // セッションを手動でリフレッシュ
    const refreshSession = useCallback(async () => {
        await checkSession();
    }, [checkSession]);

    return (
        <SystemAuthContext.Provider
            value={{
                admin,
                isAdmin: !!admin,
                isAdminLoading: !adminLoaded,
                adminLogin,
                adminLogout,
                refreshSession,
            }}
        >
            {children}
        </SystemAuthContext.Provider>
    );
}

export function useSystemAuth() {
    const context = useContext(SystemAuthContext);
    if (context === undefined) {
        throw new Error('useSystemAuth must be used within a SystemAuthProvider');
    }
    return context;
}
