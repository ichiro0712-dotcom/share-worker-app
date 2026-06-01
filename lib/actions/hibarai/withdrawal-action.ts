'use server'

import { isHibaraiEnabled } from '@/lib/features'
import { getAuthenticatedUser } from '@/src/lib/actions/helpers'
import { createWithdrawalRequest, type CreateWithdrawalForCurrentUserInput } from './withdrawal'

/**
 * ワーカー本人の出金申請を作成する公開アクション。
 * workerId はサーバー側の認証済みユーザーから取得し、クライアント値は使わない
 * （createWithdrawalRequest 本体は公開アクションにせず、ここを唯一の入口にする）。
 */
export async function createWithdrawalForCurrentUser(
  input: CreateWithdrawalForCurrentUserInput
): Promise<{ id: string; idempotencyKey: string }> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')
  const user = await getAuthenticatedUser()
  return createWithdrawalRequest({ ...input, workerId: user.id })
}
