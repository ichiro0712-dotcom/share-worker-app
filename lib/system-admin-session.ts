/**
 * システム管理者セッション管理
 *
 * セキュリティ改善:
 * 1. localStorageを使用（タブ間で共有、ブラウザを閉じても維持）
 * 2. セッションタイムアウト（8時間）
 * 3. セッション検証機能
 */

export interface SystemAdminSessionData {
    adminId: number;
    name: string;
    email: string;
    role: string;
    createdAt: number; // タイムスタンプ
    expiresAt: number; // 有効期限タイムスタンプ
}

const SESSION_KEY = 'system_admin_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8時間（ミリ秒）

/**
 * セッションを作成
 */
export function createSystemAdminSession(data: Omit<SystemAdminSessionData, 'createdAt' | 'expiresAt'>): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const sessionData: SystemAdminSessionData = {
        ...data,
        createdAt: now,
        expiresAt: now + SESSION_DURATION,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

/**
 * セッションを取得（有効期限チェック付き）
 */
export function getSystemAdminSession(): SystemAdminSessionData | null {
    if (typeof window === 'undefined') return null;

    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;

    try {
        const session: SystemAdminSessionData = JSON.parse(sessionStr);

        // 有効期限チェック
        if (Date.now() > session.expiresAt) {
            clearSystemAdminSession();
            return null;
        }

        return session;
    } catch {
        clearSystemAdminSession();
        return null;
    }
}

/**
 * セッションをクリア
 */
export function clearSystemAdminSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
}

/**
 * セッションが有効かチェック
 */
export function isSystemAdminSessionValid(): boolean {
    return getSystemAdminSession() !== null;
}

/**
 * セッションを延長（アクティビティがあった場合）
 */
export function extendSystemAdminSession(): void {
    const session = getSystemAdminSession();
    if (session) {
        session.expiresAt = Date.now() + SESSION_DURATION;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

/**
 * セッションの残り時間を取得（分）
 */
export function getSystemAdminSessionRemainingMinutes(): number {
    const session = getSystemAdminSession();
    if (!session) return 0;

    const remaining = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
}
