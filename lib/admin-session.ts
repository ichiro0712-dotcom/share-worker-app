/**
 * 施設管理者セッション管理
 *
 * セキュリティ改善:
 * 1. localStorageを使用（タブ間で共有、ブラウザを閉じても維持）
 * 2. セッションタイムアウト（8時間）
 * 3. セッション検証機能
 * 4. XSS対策（機密情報の最小化）
 */

export interface AdminSessionData {
  adminId: number;
  facilityId: number;
  name: string;
  email: string;
  role: string;
  createdAt: number; // タイムスタンプ
  expiresAt: number; // 有効期限タイムスタンプ
}

const SESSION_KEY = 'admin_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8時間（ミリ秒）

/**
 * セッションを作成
 */
export function createAdminSession(data: Omit<AdminSessionData, 'createdAt' | 'expiresAt'>): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const sessionData: AdminSessionData = {
    ...data,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  };

  // localStorageを使用（タブ間で共有）
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

  // 互換性のためcurrentAdminも更新
  const legacyData = {
    id: data.adminId,
    facilityId: data.facilityId,
    name: data.name,
    email: data.email,
    password: '', // パスワードは保存しない
    phone: '',
    role: data.role,
  };
  localStorage.setItem('currentAdmin', JSON.stringify(legacyData));
}

/**
 * セッションを取得（有効期限チェック付き）
 */
export function getAdminSession(): AdminSessionData | null {
  if (typeof window === 'undefined') return null;

  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;

  try {
    const session: AdminSessionData = JSON.parse(sessionStr);

    // 有効期限チェック
    if (Date.now() > session.expiresAt) {
      clearAdminSession();
      return null;
    }

    return session;
  } catch {
    clearAdminSession();
    return null;
  }
}

/**
 * セッションをクリア
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('currentAdmin');
}

/**
 * セッションが有効かチェック
 */
export function isAdminSessionValid(): boolean {
  return getAdminSession() !== null;
}

/**
 * セッションを延長（アクティビティがあった場合）
 */
export function extendAdminSession(): void {
  const session = getAdminSession();
  if (session) {
    session.expiresAt = Date.now() + SESSION_DURATION;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

/**
 * セッションの残り時間を取得（分）
 */
export function getSessionRemainingMinutes(): number {
  const session = getAdminSession();
  if (!session) return 0;

  const remaining = session.expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / 60000));
}
