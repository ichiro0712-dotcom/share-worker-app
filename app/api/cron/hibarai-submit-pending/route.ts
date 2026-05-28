import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { submitWithdrawalToGmo } from '@/lib/actions/hibarai/withdrawal'
import { recordHibaraiAudit } from '@/lib/actions/hibarai/audit'
import { createSupportCode, getErrorMessage } from '@/lib/actions/hibarai/utils'

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
    select: { id: true },
  })

  const summary = { submittedCount: 0, errorCount: 0 }
  for (const withdrawal of pending) {
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
