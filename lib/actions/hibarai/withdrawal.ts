'use server'

import { Prisma, WithdrawalStatus } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import {
  TransferRequestSchema,
  createGmoClient,
  generateIdempotencyKey,
  isValidIdempotencyKey,
} from '@/lib/gmo-aozora'
import type { TransferRequest } from '@/lib/gmo-aozora'
import { getAuthenticatedUser } from '@/src/lib/actions/helpers'
import { getActiveAccessToken } from './oauth-token'
import { createHibaraiAuditLog, recordHibaraiAudit } from './audit'
import {
  formatJSTDate,
  getDefaultWithdrawalFee,
  getErrorMessage,
  getJSTMonthStart,
  getTodayJSTStart,
  readPositiveIntEnv,
} from './utils'
import {
  EmergencyStoppedError,
  InsufficientBalanceError,
  InvalidIdempotencyKeyError,
  NegativeBalanceError,
  OverLimitError,
  WorkerSuspendedError,
} from './withdrawal-errors'

export type CreateWithdrawalInput = {
  workerId: number
  amount: number
  bankAccountId: string | number
  clientIp: string
  userAgent: string
  idempotencyKey?: string
}

export type CreateWithdrawalForCurrentUserInput = Omit<CreateWithdrawalInput, 'workerId'>

type LockedBalanceRow = {
  balance: number
  total_charged: number
  total_withdrawn: number
}

type LockedWithdrawalRow = {
  id: string
  worker_id: number
  requested_amount: number
  fee_amount: number
  transfer_amount: number
  status: string
  idempotency_key: string
  bank_account_id: string
  gmo_apply_no: string | null
}

type WithdrawalWithBankAccount = {
  id: string
  transfer_amount: number
  idempotency_key: string
  bank_account: {
    bankCode: string
    branchCode: string
    accountNumber: string
    accountType: 'ORDINARY' | 'CURRENT'
    accountHolderName: string
    accountHolderNameKana: string | null
  }
}

export async function createWithdrawalRequest(
  input: CreateWithdrawalInput
): Promise<{ id: string; idempotencyKey: string }> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey(`worker-${input.workerId}`)
  try {
    if (input.idempotencyKey !== undefined && !isValidIdempotencyKey(input.idempotencyKey)) {
      throw new InvalidIdempotencyKeyError('Invalid idempotencyKey')
    }

    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.withdrawalRequest.findUnique({
          where: { idempotency_key: idempotencyKey },
          select: { id: true },
        })
        if (existing) return { id: existing.id, idempotencyKey }

        if (!Number.isInteger(input.amount) || input.amount <= 0) {
          throw new Error('Invalid withdrawal amount')
        }

        const stop = await tx.emergencyStopState.findUnique({ where: { id: 'global' } })
        if (stop?.is_stopped) throw new EmergencyStoppedError('Emergency stop is active')

        const balanceRows = await tx.$queryRaw<LockedBalanceRow[]>`
          SELECT balance, total_charged, total_withdrawn
          FROM point_balances
          WHERE worker_id = ${input.workerId}
          FOR UPDATE
        `
        if (balanceRows.length === 0) throw new Error('PointBalance not found')
        const currentBalance = balanceRows[0].balance

        if (currentBalance < 0) throw new NegativeBalanceError('Negative balance')
        if (currentBalance < input.amount) throw new InsufficientBalanceError('Insufficient balance')

        const now = new Date()
        const policy = await tx.advancePaymentPolicy.findFirst({
          where: {
            worker_id: input.workerId,
            effective_from: { lte: now },
            OR: [{ effective_to: null }, { effective_to: { gt: now } }],
          },
          orderBy: { effective_from: 'desc' },
        })
        if (policy?.is_suspended) throw new WorkerSuspendedError('Worker is suspended')
        if (policy?.per_request_limit_amount && input.amount > policy.per_request_limit_amount) {
          throw new OverLimitError('Per request limit exceeded')
        }

        const bankAccount = await tx.bankAccount.findFirst({
          where: {
            id: String(input.bankAccountId),
            userId: input.workerId,
            isVerified: true,
            OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
          },
          select: { id: true },
        })
        if (!bankAccount) throw new Error('Valid bank account not found')

        await checkWithdrawalRateLimits(tx, input.workerId, input.amount, policy)

        const fee = getDefaultWithdrawalFee()
        const transferAmount = input.amount - fee
        if (transferAmount <= 0) throw new Error('Transfer amount must be positive after fee')

        await tx.pointLedgerEntry.create({
          data: {
            worker_id: input.workerId,
            kind: 'WITHDRAWAL_RESERVED',
            delta: -input.amount,
            balance_after: currentBalance - input.amount,
            idempotency_key: `reserved-${idempotencyKey}`,
            source_type: 'WithdrawalRequest',
            note: 'Withdrawal reservation',
          },
        })
        await tx.pointBalance.update({
          where: { worker_id: input.workerId },
          data: {
            balance: { decrement: input.amount },
            total_withdrawn: { increment: input.amount },
          },
        })

        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            worker_id: input.workerId,
            bank_account_id: String(input.bankAccountId),
            requested_amount: input.amount,
            fee_amount: fee,
            transfer_amount: transferAmount,
            status: 'PENDING',
            idempotency_key: idempotencyKey,
            client_ip: input.clientIp,
            user_agent: input.userAgent,
            next_poll_at: new Date(Date.now() + 60 * 1000),
          },
        })

        await createHibaraiAuditLog(tx, {
          actorType: 'WORKER',
          actorId: String(input.workerId),
          action: 'WITHDRAWAL_REQUESTED',
          targetType: 'WithdrawalRequest',
          targetId: withdrawal.id,
          idempotencyKey,
          payload: {
            amount: input.amount,
            fee,
            transferAmount,
            bankAccountId: String(input.bankAccountId),
          } as Prisma.InputJsonValue,
          result: 'SUCCESS',
          ipAddress: input.clientIp,
          userAgent: input.userAgent,
        })

        return { id: withdrawal.id, idempotencyKey }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    )
  } catch (error) {
    await recordHibaraiAudit({
      actorType: 'WORKER',
      actorId: String(input.workerId),
      action: 'WITHDRAWAL_REQUEST_FAILED',
      targetType: 'WithdrawalRequest',
      idempotencyKey: isValidIdempotencyKey(idempotencyKey) ? idempotencyKey : undefined,
      payload: { amount: input.amount, bankAccountId: String(input.bankAccountId) } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
      ipAddress: input.clientIp,
      userAgent: input.userAgent,
    }).catch(() => {})
    throw error
  }
}

export async function createWithdrawalRequestForCurrentUser(
  input: CreateWithdrawalForCurrentUserInput
): Promise<{ id: string; idempotencyKey: string }> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')
  const user = await getAuthenticatedUser()
  return createWithdrawalRequest({ ...input, workerId: user.id })
}

export async function submitWithdrawalToGmo(withdrawalRequestId: string): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  const now = new Date()
  const claimed = await prisma.withdrawalRequest.updateMany({
    where: {
      id: withdrawalRequestId,
      gmo_apply_no: null,
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', next_poll_at: { lte: now } },
      ],
    },
    data: {
      status: 'PROCESSING',
      submitted_to_gmo_at: now,
      next_poll_at: new Date(now.getTime() + 2 * 60 * 1000),
    },
  })
  if (claimed.count !== 1) return

  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalRequestId },
    include: { bank_account: true },
  })
  if (!withdrawal) return

  await recordHibaraiAudit({
    actorType: 'SYSTEM_CRON',
    action: 'WITHDRAWAL_SUBMIT_CLAIMED',
    targetType: 'WithdrawalRequest',
    targetId: withdrawalRequestId,
    idempotencyKey: withdrawal.idempotency_key,
    payload: { amount: withdrawal.requested_amount } as Prisma.InputJsonValue,
    result: 'SUCCESS',
  }).catch(() => {})

  let token: string
  let payload: TransferRequest
  let gmoClient: ReturnType<typeof createGmoClient>
  try {
    token = await getActiveAccessToken()
    if (!isValidIdempotencyKey(withdrawal.idempotency_key)) {
      throw new InvalidIdempotencyKeyError('Invalid GMO idempotency key')
    }
    payload = TransferRequestSchema.parse(buildTransferRequestPayload(withdrawal))
    gmoClient = createGmoClient()
  } catch (error) {
    await revertReservation(withdrawalRequestId, getErrorMessage(error))
    throw error
  }

  let result: Awaited<ReturnType<typeof gmoClient.requestTransfer>>
  try {
    result = await gmoClient.requestTransfer(token, withdrawal.idempotency_key, payload)
  } catch (error) {
    await markWithdrawalSubmitUnknown(withdrawalRequestId, getErrorMessage(error))
    throw error
  }

  if (result.resultCode !== '1') {
    await revertReservation(withdrawalRequestId, `GMO拒否: resultCode=${result.resultCode}`)
    throw new Error(`GMO rejected: resultCode=${result.resultCode}`)
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<LockedWithdrawalRow[]>`
          SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no
          FROM withdrawal_requests
          WHERE id = ${withdrawalRequestId}
          FOR UPDATE
        `
        const row = rows[0]
        if (!row || row.status !== 'PROCESSING') return

        await tx.withdrawalRequest.update({
          where: { id: withdrawalRequestId },
          data: {
            gmo_apply_no: result.applyNo,
            gmo_account_id: result.accountId ?? process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID ?? null,
            next_poll_at: new Date(Date.now() + 60 * 1000),
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_CRON',
          action: 'WITHDRAWAL_SUBMITTED_TO_GMO',
          targetType: 'WithdrawalRequest',
          targetId: withdrawalRequestId,
          idempotencyKey: row.idempotency_key,
          payload: { applyNo: result.applyNo, accountId: result.accountId ?? null } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 }
    )
  } catch (error) {
    await markWithdrawalSubmitUnknown(withdrawalRequestId, `DB保存失敗: ${getErrorMessage(error)}`)
    throw error
  }
}

async function markWithdrawalSubmitUnknown(withdrawalRequestId: string, reason: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: withdrawalRequestId },
        data: {
          status: 'PROCESSING',
          error_message: reason.slice(0, 1000),
          next_poll_at: new Date(Date.now() + 2 * 60 * 1000),
        },
      })
      await createHibaraiAuditLog(tx, {
        actorType: 'SYSTEM_CRON',
        action: 'WITHDRAWAL_SUBMIT_UNKNOWN',
        targetType: 'WithdrawalRequest',
        targetId: withdrawalRequestId,
        payload: { reason: reason.slice(0, 1000) } as Prisma.InputJsonValue,
        result: 'WARNING',
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 }
  )
}

export async function markWithdrawalCompleted(
  withdrawalRequestId: string,
  statusCode: number,
  statusName: string
): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<LockedWithdrawalRow[]>`
        SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no
        FROM withdrawal_requests
        WHERE id = ${withdrawalRequestId}
        FOR UPDATE
      `
      const row = rows[0]
      if (!row || row.status === 'COMPLETED') return false
      if (row.status === 'FAILED' || row.status === 'CANCELLED') return false

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
            note: statusName,
          },
        })
      }

      await tx.withdrawalRequest.update({
        where: { id: withdrawalRequestId },
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
      return true
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
  )
}

export async function revertReservation(withdrawalRequestId: string, reason: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<LockedWithdrawalRow[]>`
        SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no
        FROM withdrawal_requests
        WHERE id = ${withdrawalRequestId}
        FOR UPDATE
      `
      const row = rows[0]
      if (!row || row.status === 'COMPLETED') return false

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
            note: reason.slice(0, 1000),
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
        where: { id: withdrawalRequestId },
        data: {
          status: 'FAILED',
          failed_at: new Date(),
          last_polled_at: new Date(),
          error_message: reason.slice(0, 1000),
        },
      })
      await createHibaraiAuditLog(tx, {
        actorType: 'SYSTEM_CRON',
        action: 'WITHDRAWAL_REVERTED',
        targetType: 'WithdrawalRequest',
        targetId: row.id,
        idempotencyKey: ledgerKey,
        payload: { reason, applyNo: row.gmo_apply_no } as Prisma.InputJsonValue,
        result: 'SUCCESS',
      })
      return !existingLedger
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
  )
}

async function checkWithdrawalRateLimits(
  tx: Prisma.TransactionClient,
  workerId: number,
  amount: number,
  policy: { daily_limit_amount: number | null; monthly_limit_amount: number | null } | null
): Promise<void> {
  const todayStart = getTodayJSTStart()
  const monthStart = getJSTMonthStart()
  const activeStatus = { notIn: [WithdrawalStatus.FAILED, WithdrawalStatus.CANCELLED] }
  const [todayCount, todaySum, monthCount, monthSum] = await Promise.all([
    tx.withdrawalRequest.count({
      where: { worker_id: workerId, requested_at: { gte: todayStart }, status: activeStatus },
    }),
    tx.withdrawalRequest.aggregate({
      where: { worker_id: workerId, requested_at: { gte: todayStart }, status: activeStatus },
      _sum: { requested_amount: true },
    }),
    tx.withdrawalRequest.count({
      where: { worker_id: workerId, requested_at: { gte: monthStart }, status: activeStatus },
    }),
    tx.withdrawalRequest.aggregate({
      where: { worker_id: workerId, requested_at: { gte: monthStart }, status: activeStatus },
      _sum: { requested_amount: true },
    }),
  ])

  const dailyCountLimit = readPositiveIntEnv('HIBARAI_DAILY_WITHDRAWAL_COUNT_LIMIT', 5)
  const dailyAmountLimit = policy?.daily_limit_amount
    ?? readPositiveIntEnv('HIBARAI_DAILY_WITHDRAWAL_AMOUNT_LIMIT', 50000)
  const monthlyCountLimit = readPositiveIntEnv('HIBARAI_MONTHLY_WITHDRAWAL_COUNT_LIMIT', 10)
  const monthlyAmountLimit = policy?.monthly_limit_amount
    ?? readPositiveIntEnv('HIBARAI_MONTHLY_WITHDRAWAL_AMOUNT_LIMIT', 150000)

  if (todayCount >= dailyCountLimit) throw new OverLimitError('Daily withdrawal count limit exceeded')
  if ((todaySum._sum?.requested_amount ?? 0) + amount > dailyAmountLimit) {
    throw new OverLimitError('Daily withdrawal amount limit exceeded')
  }
  if (monthCount >= monthlyCountLimit) throw new OverLimitError('Monthly withdrawal count limit exceeded')
  if ((monthSum._sum?.requested_amount ?? 0) + amount > monthlyAmountLimit) {
    throw new OverLimitError('Monthly withdrawal amount limit exceeded')
  }
}

function buildTransferRequestPayload(withdrawal: WithdrawalWithBankAccount): TransferRequest {
  const accountId = process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID
  if (!accountId) throw new Error('GMO_AOZORA_REMITTER_ACCOUNT_ID is required')

  const beneficiaryName = withdrawal.bank_account.accountHolderNameKana
    ?? withdrawal.bank_account.accountHolderName

  return {
    accountId,
    remitterName: process.env.GMO_AOZORA_REMITTER_NAME ?? 'TASTAS',
    transferDesignatedDate: formatJSTDate(new Date()),
    transferDateHolidayCode: '1',
    totalCount: '1',
    totalAmount: String(withdrawal.transfer_amount),
    applyComment: `WID-${withdrawal.id}`,
    transfers: [
      {
        itemId: '1',
        transferAmount: String(withdrawal.transfer_amount),
        beneficiaryBankCode: withdrawal.bank_account.bankCode,
        beneficiaryBranchCode: withdrawal.bank_account.branchCode,
        accountTypeCode: withdrawal.bank_account.accountType === 'CURRENT' ? '2' : '1',
        accountNumber: withdrawal.bank_account.accountNumber,
        beneficiaryName,
      },
    ],
  }
}
