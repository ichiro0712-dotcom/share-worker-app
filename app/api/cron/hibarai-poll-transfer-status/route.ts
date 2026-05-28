import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { createGmoClient, TransferStatusResponseSchema } from '@/lib/gmo-aozora'
import { getAdminStatusInfo, isFailureStatus } from '@/lib/gmo-aozora/transfer-status'
import { getActiveAccessToken } from '@/lib/actions/hibarai/oauth-token'
import { createHibaraiAuditLog, recordHibaraiAudit } from '@/lib/actions/hibarai/audit'
import { createSupportCode, getErrorMessage } from '@/lib/actions/hibarai/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type PollWithdrawalRow = {
  id: string
  worker_id: number
  requested_amount: number
  status: string
  idempotency_key: string
  gmo_apply_no: string | null
  gmo_account_id: string | null
  poll_attempt_count: number
  settlement_month: Date
}

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stop = await prisma.emergencyStopState.findUnique({ where: { id: 'global' } })
  if (stop?.is_stopped) {
    await recordHibaraiAudit({
      actorType: 'SYSTEM_CRON',
      action: 'WITHDRAWAL_POLL_SKIPPED_EMERGENCY_STOP',
      targetType: 'EmergencyStopState',
      targetId: 'global',
      payload: { reason: stop.stopped_reason ?? null } as Prisma.InputJsonValue,
      result: 'WARNING',
    }).catch(() => {})
    return NextResponse.json({ ok: true, skipped: 'emergency_stop', successCount: 0, failureCount: 0 })
  }

  const pending = await prisma.withdrawalRequest.findMany({
    where: {
      status: { in: ['PROCESSING', 'PENDING'] },
      gmo_apply_no: { not: null },
      next_poll_at: { lte: new Date() },
    },
    take: 50,
    select: { id: true },
  })

  const token = pending.length > 0 ? await getActiveAccessToken() : null
  const gmoClient = createGmoClient()
  const summary = { successCount: 0, failureCount: 0, intermediateCount: 0, skippedCount: 0, errorCount: 0 }

  for (const withdrawal of pending) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<PollWithdrawalRow[]>`
            SELECT id, worker_id, requested_amount, status, idempotency_key, gmo_apply_no, gmo_account_id, poll_attempt_count, settlement_month
            FROM withdrawal_requests
            WHERE id = ${withdrawal.id}
              AND status IN ('PROCESSING', 'PENDING')
              AND gmo_apply_no IS NOT NULL
              AND next_poll_at <= NOW()
            FOR UPDATE SKIP LOCKED
          `
          const row = rows[0]
          if (!row || !row.gmo_apply_no || !token) return 'skipped' as const

          const accountId = row.gmo_account_id ?? process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID
          if (!accountId) throw new Error('GMO_AOZORA_REMITTER_ACCOUNT_ID is required')

          const response = await gmoClient.getTransferStatus(token, {
            accountId,
            queryKeyClass: '1',
            applyNo: row.gmo_apply_no,
          })
          const parsed = TransferStatusResponseSchema.parse(response)
          const statusCode = extractTransferStatusCode(parsed, row.gmo_apply_no)
          if (!statusCode) throw new Error('GMO transfer status code not found')
          const statusName = getAdminStatusInfo(statusCode).name

          if (statusCode === 20) {
            await completeWithdrawalInTransaction(tx, row, statusCode, statusName)
            return 'success' as const
          }

          if (statusCode === 22 || statusCode === 25 || statusCode === 40 || isFailureStatus(statusCode)) {
            await revertWithdrawalInTransaction(tx, row, statusCode, statusName)
            return 'failure' as const
          }

          await tx.withdrawalRequest.update({
            where: { id: row.id },
            data: {
              gmo_transfer_status_code: statusCode,
              gmo_transfer_status_name: statusName,
              last_polled_at: new Date(),
              next_poll_at: new Date(Date.now() + 5 * 60 * 1000),
              poll_attempt_count: { increment: 1 },
            },
          })
          await createHibaraiAuditLog(tx, {
            actorType: 'SYSTEM_CRON',
            action: 'WITHDRAWAL_POLL_INTERMEDIATE',
            targetType: 'WithdrawalRequest',
            targetId: row.id,
            idempotencyKey: `poll-${row.idempotency_key}-${row.poll_attempt_count + 1}`,
            payload: { statusCode, statusName, applyNo: row.gmo_apply_no } as Prisma.InputJsonValue,
            result: 'SUCCESS',
          })
          return 'intermediate' as const
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }
      )

      if (result === 'success') summary.successCount += 1
      if (result === 'failure') summary.failureCount += 1
      if (result === 'intermediate') summary.intermediateCount += 1
      if (result === 'skipped') summary.skippedCount += 1
    } catch (error) {
      summary.errorCount += 1
      const supportCode = createSupportCode('HBP')
      console.error('[HIBARAI_POLL_TRANSFER_STATUS_ERROR]', supportCode, withdrawal.id, getErrorMessage(error))
      await recordHibaraiAudit({
        actorType: 'SYSTEM_CRON',
        action: 'WITHDRAWAL_POLL_ERROR',
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

function extractTransferStatusCode(
  response: { transferDetails?: Array<{ applyNo?: string; transferStatus?: number; transferAccepts?: Array<{ transferStatus?: number; transferResponses?: Array<{ transferStatus?: number }> }>; transferResponses?: Array<{ transferStatus?: number }> }> },
  applyNo: string
): number | null {
  const detail = response.transferDetails?.find((item) => !item.applyNo || item.applyNo === applyNo)
    ?? response.transferDetails?.[0]
  return detail?.transferStatus
    ?? detail?.transferAccepts?.find((item) => item.transferStatus)?.transferStatus
    ?? detail?.transferAccepts?.flatMap((item) => item.transferResponses ?? []).find((item) => item.transferStatus)?.transferStatus
    ?? detail?.transferResponses?.find((item) => item.transferStatus)?.transferStatus
    ?? null
}

async function completeWithdrawalInTransaction(
  tx: Prisma.TransactionClient,
  row: PollWithdrawalRow,
  statusCode: number,
  statusName: string
): Promise<void> {
  const balanceRows = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM point_balances WHERE worker_id = ${row.worker_id} FOR UPDATE
  `
  if (balanceRows.length === 0) throw new Error('PointBalance not found')

  const ledgerKey = `completed-${row.idempotency_key}`
  const existingLedger = await tx.pointLedgerEntry.findUnique({ where: { idempotency_key: ledgerKey } })
  if (!existingLedger) {
    await tx.pointLedgerEntry.create({
      data: {
        worker_id: row.worker_id,
        kind: 'WITHDRAWAL_COMPLETED',
        delta: 0,
        balance_after: balanceRows[0].balance,
        idempotency_key: ledgerKey,
        source_id: row.id,
        source_type: 'WithdrawalRequest',
        settlement_month: row.settlement_month,
        note: statusName,
      },
    })
  }

  await tx.withdrawalRequest.update({
    where: { id: row.id },
    data: {
      status: 'COMPLETED',
      completed_at: new Date(),
      last_polled_at: new Date(),
      gmo_transfer_status_code: statusCode,
      gmo_transfer_status_name: statusName,
    },
  })
  await createHibaraiAuditLog(tx, {
    actorType: 'SYSTEM_CRON',
    action: 'WITHDRAWAL_COMPLETED',
    targetType: 'WithdrawalRequest',
    targetId: row.id,
    idempotencyKey: ledgerKey,
    payload: { statusCode, statusName, applyNo: row.gmo_apply_no } as Prisma.InputJsonValue,
    result: 'SUCCESS',
  })
}

async function revertWithdrawalInTransaction(
  tx: Prisma.TransactionClient,
  row: PollWithdrawalRow,
  statusCode: number,
  statusName: string
): Promise<void> {
  const balanceRows = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM point_balances WHERE worker_id = ${row.worker_id} FOR UPDATE
  `
  if (balanceRows.length === 0) throw new Error('PointBalance not found')

  const ledgerKey = `reverted-${row.idempotency_key}`
  const existingLedger = await tx.pointLedgerEntry.findUnique({ where: { idempotency_key: ledgerKey } })
  if (!existingLedger) {
    await tx.pointLedgerEntry.create({
      data: {
        worker_id: row.worker_id,
        kind: 'WITHDRAWAL_REVERTED',
        delta: row.requested_amount,
        balance_after: balanceRows[0].balance + row.requested_amount,
        idempotency_key: ledgerKey,
        source_id: row.id,
        source_type: 'WithdrawalRequest',
        settlement_month: row.settlement_month,
        note: statusName,
      },
    })
    await tx.pointBalance.update({
      where: { worker_id: row.worker_id },
      data: {
        balance: { increment: row.requested_amount },
        total_withdrawn: { decrement: row.requested_amount },
      },
    })
  }

  await tx.withdrawalRequest.update({
    where: { id: row.id },
    data: {
      status: 'FAILED',
      failed_at: new Date(),
      last_polled_at: new Date(),
      gmo_transfer_status_code: statusCode,
      gmo_transfer_status_name: statusName,
      error_message: statusName,
    },
  })
  await createHibaraiAuditLog(tx, {
    actorType: 'SYSTEM_CRON',
    action: 'WITHDRAWAL_REVERTED',
    targetType: 'WithdrawalRequest',
    targetId: row.id,
    idempotencyKey: ledgerKey,
    payload: { statusCode, statusName, applyNo: row.gmo_apply_no } as Prisma.InputJsonValue,
    result: 'SUCCESS',
  })
}
