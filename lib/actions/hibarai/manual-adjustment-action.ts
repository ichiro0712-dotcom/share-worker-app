'use server'

import { revalidatePath } from 'next/cache'
import { isHibaraiEnabled } from '@/lib/features'
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server'
import { applyManualAdjustment } from './manual-adjustment'

/**
 * ワーカー設定画面（クライアント）から呼ぶ残高手動調整アクション。
 * adminId はサーバー側のSystem Admin認証から取得し、クライアント値は信用しない。
 * requestId はクライアントが画面ごとに発行する二重送信防止用キー。
 */
export async function submitManualAdjustment(input: {
  workerId: number
  amount: number
  reason: string
  requestId: string
}): Promise<{ ok: true; balanceAfter: number; applied: boolean } | { ok: false; error: string }> {
  try {
    if (!isHibaraiEnabled()) return { ok: false, error: '機能が無効です' }
    const auth = await requireSystemAdminAuth()
    if (!input.requestId || input.requestId.length > 100) return { ok: false, error: 'リクエストIDが不正です' }

    const result = await applyManualAdjustment({
      workerId: input.workerId,
      amount: input.amount,
      reason: input.reason,
      adminId: auth.adminId,
      idempotencyKey: `worker-${input.workerId}-${input.requestId}`,
    })

    revalidatePath(`/system-admin/hibarai/workers/${input.workerId}/settings`)
    return { ok: true, balanceAfter: result.balanceAfter, applied: result.applied }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '調整に失敗しました' }
  }
}
