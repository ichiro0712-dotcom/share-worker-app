import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { submitWithdrawalToGmo } from '@/lib/actions/hibarai/withdrawal'
import { recordHibaraiAudit } from '@/lib/actions/hibarai/audit'
import { createSupportCode, getErrorMessage } from '@/lib/actions/hibarai/utils'
import { getGmoRemitterBalance } from '@/lib/actions/hibarai/settings'
import { planFundedSubmissions } from '@/lib/actions/hibarai/submit-funds-gate'
import { notifyWorkerWithdrawalFailed } from '@/lib/actions/hibarai/failure-notification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stop = await prisma.emergencyStopState.findUnique({ where: { id: 'global' } })
  if (stop?.is_stopped) {
    await recordHibaraiAudit({
      actorType: 'SYSTEM_CRON',
      action: 'WITHDRAWAL_SUBMIT_SKIPPED_EMERGENCY_STOP',
      targetType: 'EmergencyStopState',
      targetId: 'global',
      payload: { reason: stop.stopped_reason ?? null } as Prisma.InputJsonValue,
      result: 'WARNING',
    }).catch(() => {})
    return NextResponse.json({ ok: true, skipped: 'emergency_stop', processed: 0, submittedCount: 0, errorCount: 0 })
  }

  const now = new Date()
  const pending = await prisma.withdrawalRequest.findMany({
    where: {
      gmo_apply_no: null,
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', next_poll_at: { lte: now } },
      ],
    },
    orderBy: { requested_at: 'asc' },
    take: 50,
    select: { id: true, transfer_amount: true },
  })

  // 送金元残高で送れる依頼だけを送信する（不足分は未送金のまま据え置き＝失敗にしない）。
  // GMO未接続/dummyで残高取得不可のときは資金ゲートしない(null)→従来どおり全件試行。
  const remitter = await getGmoRemitterBalance()
  const availableFunds = remitter.available ? remitter.withdrawableAmount : null
  const { submit, skipped } = planFundedSubmissions(
    pending.map((p) => ({ id: p.id, transferAmount: p.transfer_amount })),
    availableFunds,
  )
  const submitSet = new Set(submit)

  if (skipped.length > 0) {
    await recordHibaraiAudit({
      actorType: 'SYSTEM_CRON',
      action: 'WITHDRAWAL_SUBMIT_SKIPPED_INSUFFICIENT_FUNDS',
      targetType: 'GmoBalance',
      targetId: 'remitter',
      payload: { skippedCount: skipped.length, availableFunds } as Prisma.InputJsonValue,
      result: 'WARNING',
    }).catch(() => {})
  }

  const summary = { submittedCount: 0, errorCount: 0, skippedInsufficientFunds: skipped.length }
  for (const withdrawal of pending) {
    if (!submitSet.has(withdrawal.id)) continue // 残高不足: 未送金のまま次回cronで再評価
    try {
      await submitWithdrawalToGmo(withdrawal.id)
      summary.submittedCount += 1
    } catch (error) {
      summary.errorCount += 1
      const supportCode = createSupportCode('HBS')
      console.error('[HIBARAI_SUBMIT_PENDING_ERROR]', supportCode, withdrawal.id, getErrorMessage(error))
      await recordHibaraiAudit({
        actorType: 'SYSTEM_CRON',
        action: 'WITHDRAWAL_SUBMIT_PENDING_ERROR',
        targetType: 'WithdrawalRequest',
        targetId: withdrawal.id,
        payload: { supportCode } as Prisma.InputJsonValue,
        result: 'ERROR',
        errorCode: supportCode,
      }).catch(() => {})
      // 送信時に口座不備等でFAILEDへ戻った場合のみワーカーへ通知（helperがstatus=FAILEDを判定）。
      // PROCESSING維持（GMO到達不明）の場合は通知しない。
      notifyWorkerWithdrawalFailed(withdrawal.id).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, processed: pending.length, ...summary })
}

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true
  return new URL(request.url).searchParams.get('secret') === secret
}
