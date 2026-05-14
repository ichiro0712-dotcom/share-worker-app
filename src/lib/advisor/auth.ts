/**
 * Advisor 専用の認証ガード
 *
 * 既存の lib/system-admin-session-server.ts をラップして、
 * API Route と Server Component から共通利用できる形にしたもの。
 */

import {
  getSystemAdminSessionData,
  requireSystemAdminAuth,
} from '@/lib/system-admin-session-server';

export interface AdvisorAuthInfo {
  adminId: number;
  name: string;
  email: string;
  role: string;
}

/**
 * Advisor 認証チェック (失敗時はエラーをスロー)
 * Server Component / Server Action / API Route で使用
 */
export async function requireAdvisorAuth(): Promise<AdvisorAuthInfo> {
  const auth = await requireSystemAdminAuth();
  return {
    adminId: auth.adminId,
    name: auth.name,
    email: auth.email,
    role: auth.role,
  };
}

/**
 * Advisor 認証チェック (失敗時は null を返す)
 * UI でログインしているか確認したいだけの場合
 */
export async function getAdvisorAuth(): Promise<AdvisorAuthInfo | null> {
  const data = await getSystemAdminSessionData();
  if (!data || !data.isLoggedIn || !data.adminId) {
    return null;
  }
  return {
    adminId: data.adminId,
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role ?? '',
  };
}

/**
 * Advisor 機能が有効かのチェック (環境変数による全停止スイッチ)
 */
export function isAdvisorEnabled(): boolean {
  return process.env.ADVISOR_FEATURE_ENABLED !== 'false';
}
