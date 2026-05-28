'use server'

import { requireSystemAdminAuth } from '@/lib/system-admin-session-server'
import { setAdvancePaymentPolicy, type SetAdvancePaymentPolicyInput } from './policy'

/**
 * A4画面（クライアント）から呼ぶ前払いポリシー保存アクション。
 * adminId はサーバー側のSystem Admin認証から取得し、クライアント値は信用しない。
 */
export async function saveWorkerPolicy(
  input: SetAdvancePaymentPolicyInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const auth = await requireSystemAdminAuth()
    const result = await setAdvancePaymentPolicy(input, auth.adminId)
    return { ok: true, id: result.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存に失敗しました' }
  }
}
