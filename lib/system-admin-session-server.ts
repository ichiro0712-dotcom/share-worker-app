'use server';

import { cookies } from 'next/headers';
import { getIronSession, SessionOptions } from 'iron-session';

/**
 * システム管理者セッションデータ
 */
export interface SystemAdminSessionData {
  adminId?: number;
  name?: string;
  email?: string;
  role?: string;
  isLoggedIn: boolean;
}

/**
 * セッション用パスワードを取得（本番環境では環境変数必須）
 */
function getSessionPassword(): string {
  const secret = process.env.SYSTEM_ADMIN_SESSION_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'SYSTEM_ADMIN_SESSION_SECRET environment variable is required in production and must be at least 32 characters'
      );
    }
    return secret;
  }

  // 開発環境ではデフォルト値を許容（警告付き）
  if (!secret) {
    console.warn('[WARNING] SYSTEM_ADMIN_SESSION_SECRET is not set. Using default value for development only.');
  }
  return secret || 'complex_password_at_least_32_characters_long_for_system_admin_dev_only';
}

/**
 * セッション設定を取得（遅延評価でビルド時エラーを回避）
 */
function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: 'system_admin_session',
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
export async function getSystemAdminServerSession() {
  const session = await getIronSession<SystemAdminSessionData>(await cookies(), getSessionOptions());
  return session;
}

/**
 * セッションを作成（ログイン時）
 */
export async function createSystemAdminServerSession(data: {
  adminId: number;
  name: string;
  email: string;
  role: string;
}) {
  const session = await getSystemAdminServerSession();
  session.adminId = data.adminId;
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
export async function clearSystemAdminServerSession() {
  const session = await getSystemAdminServerSession();
  session.destroy();
  return { success: true };
}

/**
 * セッションが有効かチェック（Server Action用）
 * 無効な場合はエラーをスロー
 */
export async function requireSystemAdminAuth(): Promise<{
  adminId: number;
  name: string;
  email: string;
  role: string;
}> {
  const session = await getSystemAdminServerSession();

  if (!session.isLoggedIn || !session.adminId) {
    throw new Error('システム管理者認証が必要です');
  }

  return {
    adminId: session.adminId,
    name: session.name || '',
    email: session.email || '',
    role: session.role || '',
  };
}

/**
 * セッション情報を取得（認証チェックなし）
 */
export async function getSystemAdminSessionData(): Promise<SystemAdminSessionData | null> {
  const session = await getSystemAdminServerSession();

  if (!session.isLoggedIn || !session.adminId) {
    return null;
  }

  return {
    adminId: session.adminId,
    name: session.name,
    email: session.email,
    role: session.role,
    isLoggedIn: true,
  };
}
