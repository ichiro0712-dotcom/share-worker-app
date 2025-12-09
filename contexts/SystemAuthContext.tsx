'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import {
    createSystemAdminSession,
    getSystemAdminSession,
    clearSystemAdminSession,
    extendSystemAdminSession,
    getSystemAdminSessionRemainingMinutes,
    SystemAdminSessionData
} from '@/lib/system-admin-session';
import { authenticateSystemAdmin } from '@/src/lib/actions';

interface SystemAuthContextType {
    admin: SystemAdminSessionData | null;
    isAdmin: boolean;
    isAdminLoading: boolean;
    adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    adminLogout: () => void;
    sessionRemainingMinutes: number;
    extendSession: () => void;
}

const SystemAuthContext = createContext<SystemAuthContextType | undefined>(undefined);

export function SystemAuthProvider({ children }: { children: ReactNode }) {
    const [admin, setAdmin] = useState<SystemAdminSessionData | null>(null);
    const [adminLoaded, setAdminLoaded] = useState(false);
    const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(0);

    // Restore session
    useEffect(() => {
        const restoreSession = () => {
            const sessionData = getSystemAdminSession();
            if (sessionData) {
                setAdmin(sessionData);
                setSessionRemainingMinutes(getSystemAdminSessionRemainingMinutes());
            }
            setAdminLoaded(true);
        };
        restoreSession();
    }, []);

    // Check expiration
    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = getSystemAdminSessionRemainingMinutes();
            setSessionRemainingMinutes(remaining);
            if (remaining === 0) {
                const currentSession = getSystemAdminSession();
                if (!currentSession && admin) {
                    setAdmin(null);
                    clearSystemAdminSession();
                }
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [admin]);

    // Activity monitor
    useEffect(() => {
        if (!admin) return;
        const handleActivity = () => {
            extendSystemAdminSession();
            setSessionRemainingMinutes(getSystemAdminSessionRemainingMinutes());
        };
        window.addEventListener('click', handleActivity);
        window.addEventListener('keydown', handleActivity);
        return () => {
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('keydown', handleActivity);
        };
    }, [admin]);

    const adminLogin = async (email: string, password: string) => {
        try {
            const result = await authenticateSystemAdmin(email, password);
            if (result.success && result.admin) {
                const sessionData: Omit<SystemAdminSessionData, 'createdAt' | 'expiresAt'> = {
                    adminId: result.admin.id,
                    name: result.admin.name,
                    email: result.admin.email,
                    role: result.admin.role,
                };
                createSystemAdminSession(sessionData);

                // Refetch to get full object with timestamps
                const fullSession = getSystemAdminSession();
                setAdmin(fullSession);
                setSessionRemainingMinutes(getSystemAdminSessionRemainingMinutes());
                return { success: true };
            }
            return { success: false, error: result.error || 'ログインに失敗しました' };
        } catch (error) {
            console.error('System Admin login error:', error);
            return { success: false, error: 'ログイン中にエラーが発生しました' };
        }
    };

    const adminLogout = useCallback(() => {
        setAdmin(null);
        clearSystemAdminSession();
    }, []);

    const extendSession = useCallback(() => {
        extendSystemAdminSession();
        setSessionRemainingMinutes(getSystemAdminSessionRemainingMinutes());
    }, []);

    return (
        <SystemAuthContext.Provider
            value={{
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
