'use server'

import { isHibaraiEnabled } from '@/lib/features'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'
import { triggerEmergencyStop, releaseEmergencyStop } from './emergency-stop'

type ActionResult = { ok: true } | { ok: false; error: string }

/** 緊急停止する（単独可）。System Admin 認証必須・理由必須。 */
export async function triggerStopAction(reason: string): Promise<ActionResult> {
  if (!isHibaraiEnabled()) return { ok: false, error: 'Feature disabled' }
  const session = await getSystemAdminSessionData()
  if (!session?.adminId) return { ok: false, error: '認証が必要です' }
  const r = reason.trim()
  if (!r) return { ok: false, error: '停止理由を入力してください' }
  try {
    await triggerEmergencyStop(session.adminId, r)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '停止に失敗しました' }
  }
}

/** 緊急停止を解除する（単独可）。System Admin 認証必須・理由必須。 */
export async function releaseStopAction(reason: string): Promise<ActionResult> {
  if (!isHibaraiEnabled()) return { ok: false, error: 'Feature disabled' }
  const session = await getSystemAdminSessionData()
  if (!session?.adminId) return { ok: false, error: '認証が必要です' }
  const r = reason.trim()
  if (!r) return { ok: false, error: '解除理由を入力してください' }
  try {
    await releaseEmergencyStop(session.adminId, r)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '解除に失敗しました' }
  }
}
