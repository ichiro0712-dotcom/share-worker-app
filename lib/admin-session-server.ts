'use server';

import { cookies } from 'next/headers';
import { getIronSession, SessionOptions } from 'iron-session';

/**
 * 施設管理者セッションデータ（サーバーサイド）
 *
 * このモジュールはiron-sessionを使用してサーバーサイドで
 * 施設管理者の認証状態を管理します。
 *
 * セキュリティ特性:
 * - httpOnly Cookie（JavaScriptからアクセス不可、XSS耐性）
 * - 暗号化されたセッションデータ
 * - sameSite='lax'（基本的なCSRF保護）
 * - 本番環境ではsecure属性必須
 */
export interface FacilityAdminSessionData {
  adminId?: number;
  facilityId?: number;
  name?: string;
  email?: string;
  role?: string;
  isLoggedIn: boolean;
}

/**
 * セッション用パスワードを取得（本番環境では環境変数必須）
 */
function getSessionPassword(): string {
  const secret = process.env.FACILITY_ADMIN_SESSION_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'FACILITY_ADMIN_SESSION_SECRET environment variable is required in production and must be at least 32 characters'
      );
    }
    return secret;
  }

  // 開発環境ではデフォルト値を許容（警告付き）
  if (!secret) {
    console.warn('[WARNING] FACILITY_ADMIN_SESSION_SECRET is not set. Using default value for development only.');
  }
  return secret || 'complex_password_at_least_32_characters_long_for_facility_admin_dev_only';
}

/**
 * セッション設定を取得（遅延評価でビルド時エラーを回避）
 */
function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: 'facility_admin_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8時間
    },
  };
}

/**
 * セッションを取得
 */
export async function getFacilityAdminSession() {
  const session = await getIronSession<FacilityAdminSessionData>(await cookies(), getSessionOptions());
  return session;
}

/**
 * セッションを作成（ログイン時）
 */
export async function createFacilityAdminSession(data: {
  adminId: number;
  facilityId: number;
  name: string;
  email: string;
  role: string;
}) {
  const session = await getFacilityAdminSession();
  session.adminId = data.adminId;
  session.facilityId = data.facilityId;
  session.name = data.name;
  session.email = data.email;
  session.role = data.role;
  session.isLoggedIn = true;
  await session.save();
  return { success: true };
}

/**
 * セッションをクリア（ログアウト時）
 */
export async function clearFacilityAdminSession() {
  const session = await getFacilityAdminSession();
  session.destroy();
  return { success: true };
}

/**
 * セッションが有効かチェック（Server Action用）
 * 無効な場合はエラーをスロー
 */
export async function requireFacilityAdminAuth(): Promise<{
  adminId: number;
  facilityId: number;
  name: string;
  email: string;
  role: string;
}> {
  const session = await getFacilityAdminSession();

  if (!session.isLoggedIn || !session.adminId || !session.facilityId) {
    throw new Error('施設管理者認証が必要です');
  }

  return {
    adminId: session.adminId,
    facilityId: session.facilityId,
    name: session.name || '',
    email: session.email || '',
    role: session.role || '',
  };
}

/**
 * セッション情報を取得（認証チェックなし）
 */
export async function getFacilityAdminSessionData(): Promise<FacilityAdminSessionData | null> {
  const session = await getFacilityAdminSession();

  if (!session.isLoggedIn || !session.adminId || !session.facilityId) {
    return null;
  }

  return {
    adminId: session.adminId,
    facilityId: session.facilityId,
    name: session.name,
    email: session.email,
    role: session.role,
    isLoggedIn: true,
  };
}

/**
 * facilityIdの所有権を検証
 * リクエストされたfacilityIdがセッションのfacilityIdと一致するかチェック
 */
export async function validateFacilityAccess(requestedFacilityId: number): Promise<{
  valid: boolean;
  session: FacilityAdminSessionData | null;
  error?: 'unauthorized' | 'forbidden';
}> {
  const session = await getFacilityAdminSessionData();

  // 未認証
  if (!session || !session.facilityId) {
    return { valid: false, session: null, error: 'unauthorized' };
  }

  // 他施設へのアクセス試行
  if (session.facilityId !== requestedFacilityId) {
    console.warn(
      `[Security] Facility access denied: session.facilityId=${session.facilityId}, requested=${requestedFacilityId}, adminId=${session.adminId}`
    );
    return { valid: false, session, error: 'forbidden' };
  }

  return { valid: true, session };
}
