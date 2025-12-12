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
 * セッション設定
 */
const sessionOptions: SessionOptions = {
  password: process.env.SYSTEM_ADMIN_SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_system_admin',
  cookieName: 'system_admin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8時間
  },
};

/**
 * セッションを取得
 */
export async function getSystemAdminServerSession() {
  const session = await getIronSession<SystemAdminSessionData>(await cookies(), sessionOptions);
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
