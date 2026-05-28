'use server'

import { isHibaraiEnabled } from '@/lib/features'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'
import { getAdminWithdrawalDetail, type AdminWithdrawalDetail } from './admin-withdrawals'

/**
 * A5テーブル（クライアント）から1件詳細を取得する公開アクション。
 * 機能フラグ + System Admin 認証必須。
 */
export async function fetchWithdrawalDetail(id: string): Promise<AdminWithdrawalDetail | null> {
  if (!isHibaraiEnabled()) return null
  const session = await getSystemAdminSessionData()
  if (!session) return null
  return getAdminWithdrawalDetail(id)
}
