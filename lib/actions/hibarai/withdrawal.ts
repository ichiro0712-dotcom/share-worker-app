// 'use server' にしない。createWithdrawalRequest(任意workerId)・submitWithdrawalToGmo・
// markWithdrawalCompleted・revertReservation 等の金銭プリミティブを公開アクションとして露出させないため。
// 公開アクションは認証付きの withdrawal-action.ts(createWithdrawalForCurrentUser) のみ。
// submit/poll/revert は cron 等のサーバーサイドからのみ呼ぶ。
import { Prisma, WithdrawalStatus } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { workerBankLockKey } from './bank-account-bridge'
import {
  GmoApiError,
  TransferRequestSchema,
  createGmoClient,
  generateIdempotencyKey,
  isValidIdempotencyKey,
} from '@/lib/gmo-aozora'
import type { TransferRequest } from '@/lib/gmo-aozora'
import { getActiveAccessToken } from './oauth-token'
import { createHibaraiAuditLog, recordHibaraiAudit } from './audit'
import { getEffectiveWithdrawalFee } from './settings'
import {
  formatJSTDate,
  getErrorMessage,
  getJSTMonthStart,
  getJSTSettlementMonthStart,
  getTodayJSTStart,
  readPositiveIntEnv,
} from './utils'
import {
  EmergencyStoppedError,
  InsufficientBalanceError,
  InvalidIdempotencyKeyError,
  NegativeBalanceError,
  OverLimitError,
  ProgramNotAllowedError,
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
  settlement_month: Date
}

type BankSnapshot = {
  bankCode: string
  branchCode: string
  accountType: 'ORDINARY' | 'CURRENT'
  accountNumber: string
  accountHolderName: string
  accountHolderNameKana: string | null
  /** 申請時点の口座更新時刻(epoch ms)。送信時の口座変更検知に使う。 */
  lastChangedAt: number | null
}

type WithdrawalForSubmit = {
  id: string
  transfer_amount: number
  idempotency_key: string
  bank_snapshot: BankSnapshot
}

function parseBankSnapshot(value: unknown): BankSnapshot {
  if (!value || typeof value !== 'object') throw new Error('bank_snapshot is missing or invalid')
  const s = value as Record<string, unknown>
  if (
    typeof s.bankCode !== 'string' ||
    typeof s.branchCode !== 'string' ||
    (s.accountType !== 'ORDINARY' && s.accountType !== 'CURRENT') ||
    typeof s.accountNumber !== 'string' ||
    typeof s.accountHolderName !== 'string'
  ) {
    throw new Error('bank_snapshot has invalid shape')
  }
  // accountHolderNameKana は string | null のみ許可
  if (s.accountHolderNameKana != null && typeof s.accountHolderNameKana !== 'string') {
    throw new Error('bank_snapshot.accountHolderNameKana invalid')
  }
  // lastChangedAt は変更検知キー。null か safe integer のみ許可（型不正は弾く）
  if (s.lastChangedAt != null && (typeof s.lastChangedAt !== 'number' || !Number.isSafeInteger(s.lastChangedAt))) {
    throw new Error('bank_snapshot.lastChangedAt invalid')
  }
  return {
    bankCode: s.bankCode,
    branchCode: s.branchCode,
    accountType: s.accountType,
    accountNumber: s.accountNumber,
    accountHolderName: s.accountHolderName,
    accountHolderNameKana: (s.accountHolderNameKana as string | null) ?? null,
    lastChangedAt: (s.lastChangedAt as number | null) ?? null,
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

    // 有効手数料はトランザクション開始前に確定（申請時の値をsnapshotとして保存）
    const fee = await getEffectiveWithdrawalFee()

    return await prisma.$transaction(
      async (tx) => {
        // ワーカー銀行ロック: プロフィール口座編集 tx と同じキーを取り直列化する。
        // 「W3/W4ガード（編集中の出金作成禁止）」のTOCTOUを排除する目的で、両者が同じキーを取る運用。
        const bankLockKey = workerBankLockKey(input.workerId)
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${bankLockKey}::bigint)`)

        const existing = await tx.withdrawalRequest.findUnique({
          where: { idempotency_key: idempotencyKey },
          select: { id: true },
        })
        if (existing) return { id: existing.id, idempotencyKey }

        if (!Number.isInteger(input.amount) || input.amount <= 0) {
          throw new Error('Invalid withdrawal amount')
        }

        // 停止行をロックしてから判定し、停止コミットとの競合（停止前のfalseを読んで申請成立）を防ぐ
        await tx.$queryRaw`SELECT id FROM emergency_stop_states WHERE id = 'global' FOR UPDATE`
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
        // 日払い(HIBARAI)以外のプログラム(LEGACY_CARRYBARAI/DISABLED)は出金不可
        if (policy && policy.advance_program !== 'HIBARAI') {
          throw new ProgramNotAllowedError('Advance program is not HIBARAI')
        }
        if (policy?.per_request_limit_amount != null && input.amount > policy.per_request_limit_amount) {
          throw new OverLimitError('Per request limit exceeded')
        }

        const bankAccount = await tx.bankAccount.findFirst({
          where: {
            id: String(input.bankAccountId),
            userId: input.workerId,
            isVerified: true,
            OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
          },
          select: {
            id: true,
            bankCode: true,
            branchCode: true,
            accountType: true,
            accountNumber: true,
            accountHolderName: true,
            accountHolderNameKana: true,
            lastChangedAt: true,
          },
        })
        if (!bankAccount) throw new Error('Valid bank account not found')

        // 申請時の口座を凍結(snapshot)。GMO送金はこの値のみ使う。
        const bankSnapshot: BankSnapshot = {
          bankCode: bankAccount.bankCode,
          branchCode: bankAccount.branchCode,
          accountType: bankAccount.accountType,
          accountNumber: bankAccount.accountNumber,
          accountHolderName: bankAccount.accountHolderName,
          accountHolderNameKana: bankAccount.accountHolderNameKana,
          lastChangedAt: bankAccount.lastChangedAt ? bankAccount.lastChangedAt.getTime() : null,
        }

        await checkWithdrawalRateLimits(tx, input.workerId, input.amount, policy)

        const transferAmount = input.amount - fee
        if (transferAmount <= 0) throw new Error('Transfer amount must be positive after fee')

        // 申請時に開いている精算月(JST)を刻む。失敗・組戻しでも変えない。
        const settlementMonth = getJSTSettlementMonthStart(now)

        await tx.pointLedgerEntry.create({
          data: {
            worker_id: input.workerId,
            kind: 'WITHDRAWAL_RESERVED',
            delta: -input.amount,
            balance_after: currentBalance - input.amount,
            idempotency_key: `reserved-${idempotencyKey}`,
            source_type: 'WithdrawalRequest',
            settlement_month: settlementMonth,
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
            settlement_month: settlementMonth,
            bank_snapshot: bankSnapshot as unknown as Prisma.InputJsonValue,
            // settlement_month と requested_at を同一 now から導出し、月境界での乖離を防ぐ
            requested_at: now,
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

export async function submitWithdrawalToGmo(withdrawalRequestId: string): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  // 緊急停止中は送金しない（cron入口チェックに加え、送信直前にも再確認する多層防御）
  const stop = await prisma.emergencyStopState.findUnique({ where: { id: 'global' } })
  if (stop?.is_stopped) return

  const now = new Date()
  // 初回送信(PENDING)か、応答不明後の再送(既にPROCESSING)かを判定する。
  // 再送時はGMOへ到達済みの可能性があるため、口座再検査でrevertしてはならない（二重送金防止）。
  const preClaim = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalRequestId },
    select: { status: true },
  })
  const isFirstSend = preClaim?.status === 'PENDING'

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

  // ローカル失敗時の後始末: 初回送信なら返金(revert)、再送なら返金せずPROCESSING維持
  // （初回送信がGMOへ到達済みの可能性があるため、再送のローカル失敗で返金すると二重支払いになる）。
  const failBeforeGmo = async (reason: string): Promise<void> => {
    if (isFirstSend) await revertReservation(withdrawalRequestId, reason)
    else await markWithdrawalSubmitUnknown(withdrawalRequestId, reason)
  }

  let snapshot: BankSnapshot
  try {
    snapshot = parseBankSnapshot(withdrawal.bank_snapshot)
  } catch (error) {
    await failBeforeGmo(`口座スナップショット不正: ${getErrorMessage(error)}`)
    throw error
  }

  // 初回送信のみ、振込先口座を再検査する。送金は snapshot から行うが、申請後に
  // 口座が変更/cooldown/未認証になっていたら、どちらの口座にも送らず中止(revert)する。
  // 変更検知は lastChangedAt に依存せず、口座フィールドの直接比較で行う（堅牢）。
  // ※再送(isFirstSend=false)では、GMOへ到達済みの可能性があるため再検査しない。
  if (isFirstSend) {
    const currentAccount = withdrawal.bank_account
    const inCooldown = !!currentAccount?.cooldownUntil && currentAccount.cooldownUntil > now
    const accountChanged =
      !!currentAccount &&
      (snapshot.bankCode !== currentAccount.bankCode ||
        snapshot.branchCode !== currentAccount.branchCode ||
        snapshot.accountType !== currentAccount.accountType ||
        snapshot.accountNumber !== currentAccount.accountNumber ||
        snapshot.accountHolderName !== currentAccount.accountHolderName ||
        (snapshot.accountHolderNameKana ?? null) !== (currentAccount.accountHolderNameKana ?? null) ||
        snapshot.lastChangedAt !== (currentAccount.lastChangedAt ? currentAccount.lastChangedAt.getTime() : null))
    if (!currentAccount || !currentAccount.isVerified || inCooldown || accountChanged) {
      const reason = !currentAccount
        ? '振込先口座が見つかりません'
        : accountChanged
          ? '申請後に振込先口座が変更されたため中止しました'
          : inCooldown
            ? '振込先口座がcooldown中のため中止しました'
            : '振込先口座が未認証のため中止しました'
      await revertReservation(withdrawalRequestId, reason)
      throw new Error(reason)
    }
  }

  // === 不明復旧 ===
  // 過去の送信試行でGMO申込番号(applyNo)を得ていれば、再送せずそれを回収する。
  // 初回送信がGMOへ到達したがDB保存に失敗した等の取りこぼしによる二重送金を防ぐ。
  const priorAttempt = await prisma.transferAttempt.findFirst({
    where: { withdrawal_request_id: withdrawalRequestId, gmo_apply_no: { not: null } },
    orderBy: { attempt_no: 'desc' },
  })
  if (priorAttempt?.gmo_apply_no) {
    await saveGmoApplyNo(withdrawalRequestId, priorAttempt.gmo_apply_no, null)
    return
  }

  let token: string
  let payload: TransferRequest
  let gmoClient: ReturnType<typeof createGmoClient>
  try {
    token = await getActiveAccessToken()
    if (!isValidIdempotencyKey(withdrawal.idempotency_key)) {
      throw new InvalidIdempotencyKeyError('Invalid GMO idempotency key')
    }
    payload = TransferRequestSchema.parse(
      buildTransferRequestPayload({
        id: withdrawal.id,
        transfer_amount: withdrawal.transfer_amount,
        idempotency_key: withdrawal.idempotency_key,
        bank_snapshot: snapshot,
      })
    )
    gmoClient = createGmoClient()
  } catch (error) {
    await failBeforeGmo(getErrorMessage(error))
    throw error
  }

  const attemptAgg = await prisma.transferAttempt.aggregate({
    where: { withdrawal_request_id: withdrawalRequestId },
    _max: { attempt_no: true },
  })
  const attemptNo = (attemptAgg._max.attempt_no ?? 0) + 1
  const startedAt = Date.now()

  let result: Awaited<ReturnType<typeof gmoClient.requestTransfer>>
  try {
    result = await gmoClient.requestTransfer(token, withdrawal.idempotency_key, payload)
  } catch (error) {
    await recordTransferAttempt({
      withdrawalRequestId,
      attemptNo,
      idempotencyKey: withdrawal.idempotency_key,
      payload,
      responseStatusCode: error instanceof GmoApiError ? error.statusCode : null,
      responseBody: null,
      gmoApplyNo: null,
      errorCode: error instanceof GmoApiError ? error.errorCode : error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      durationMs: Date.now() - startedAt,
    })
    // GMOへ到達したか不明なため返金せずPROCESSING維持（再送/照会で解決）
    await markWithdrawalSubmitUnknown(withdrawalRequestId, getErrorMessage(error))
    throw error
  }

  // 試行を記録（成功。resultCodeが1/2いずれでもapplyNoを保存しておく）
  await recordTransferAttempt({
    withdrawalRequestId,
    attemptNo,
    idempotencyKey: withdrawal.idempotency_key,
    payload,
    responseStatusCode: 200,
    responseBody: result as unknown,
    gmoApplyNo: result.applyNo,
    errorCode: null,
    durationMs: Date.now() - startedAt,
  })

  // resultCode 1:完了 / 2:未完了 はいずれもGMOに受理されている（applyNo採番済み）。
  // 返金せずapplyNoを保存し、最終確定はpoll cronのtransferStatusに委ねる。
  await saveGmoApplyNo(withdrawalRequestId, result.applyNo, result.accountId ?? null)
}

async function saveGmoApplyNo(
  withdrawalRequestId: string,
  applyNo: string,
  accountId: string | null
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<LockedWithdrawalRow[]>`
          SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no, settlement_month
          FROM withdrawal_requests
          WHERE id = ${withdrawalRequestId}
          FOR UPDATE
        `
        const row = rows[0]
        if (!row || row.status !== 'PROCESSING') return
        if (row.gmo_apply_no) {
          // 同一applyNoなら冪等にno-op。別applyNoは本来ありえない異常なので監査に残す（上書きはしない）。
          if (row.gmo_apply_no !== applyNo) {
            await createHibaraiAuditLog(tx, {
              actorType: 'SYSTEM_CRON',
              action: 'WITHDRAWAL_APPLY_NO_CONFLICT',
              targetType: 'WithdrawalRequest',
              targetId: withdrawalRequestId,
              payload: { existing: row.gmo_apply_no, incoming: applyNo } as Prisma.InputJsonValue,
              result: 'WARNING',
            })
          }
          return
        }

        await tx.withdrawalRequest.update({
          where: { id: withdrawalRequestId },
          data: {
            gmo_apply_no: applyNo,
            gmo_account_id: accountId ?? process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID ?? null,
            next_poll_at: new Date(Date.now() + 60 * 1000),
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_CRON',
          action: 'WITHDRAWAL_SUBMITTED_TO_GMO',
          targetType: 'WithdrawalRequest',
          targetId: withdrawalRequestId,
          idempotencyKey: row.idempotency_key,
          payload: { applyNo, accountId: accountId ?? null } as Prisma.InputJsonValue,
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

async function recordTransferAttempt(params: {
  withdrawalRequestId: string
  attemptNo: number
  idempotencyKey: string
  payload: TransferRequest
  responseStatusCode: number | null
  responseBody: unknown
  gmoApplyNo: string | null
  errorCode: string | null
  durationMs: number
}): Promise<void> {
  // 法的保存・フォレンジック用の append-only 記録。失敗しても本処理は止めない
  // （idempotency-key 再送がGMO側の重複防止の最終的な砦）。
  // ⚠ Bearerトークンは記録しない。request_bodyは送信内容(口座番号含む)で内部監査専用。
  await prisma.transferAttempt
    .create({
      data: {
        withdrawal_request_id: params.withdrawalRequestId,
        attempt_no: params.attemptNo,
        idempotency_key: params.idempotencyKey,
        request_method: 'POST',
        request_url: '/transfer/request',
        request_headers: { 'Idempotency-Key': params.idempotencyKey } as Prisma.InputJsonValue,
        request_body: params.payload as unknown as Prisma.InputJsonValue,
        response_status_code: params.responseStatusCode,
        response_body: (params.responseBody ?? null) as Prisma.InputJsonValue,
        gmo_apply_no: params.gmoApplyNo,
        error_code: params.errorCode,
        duration_ms: params.durationMs,
      },
    })
    .catch(() => {})
}

async function markWithdrawalSubmitUnknown(withdrawalRequestId: string, reason: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM withdrawal_requests WHERE id = ${withdrawalRequestId} FOR UPDATE
      `
      const current = rows[0]
      // 既に終端状態(COMPLETED/FAILED/CANCELLED/REFUNDED)なら PROCESSING へ巻き戻さない。
      // 長時間実行や手動実行で後続処理が確定させた後の古いsubmitによる状態退行を防ぐ。
      if (!current || ['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(current.status)) return

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
        SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no, settlement_month
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
            settlement_month: row.settlement_month,
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
        SELECT id, worker_id, requested_amount, fee_amount, transfer_amount, status, idempotency_key, bank_account_id, gmo_apply_no, settlement_month
        FROM withdrawal_requests
        WHERE id = ${withdrawalRequestId}
        FOR UPDATE
      `
      const row = rows[0]
      if (!row || row.status === 'COMPLETED') return false
      // GMO申込番号がある＝GMOに受理済み。送金が成立している可能性があるため、
      // この経路(送信前/明示拒否)では戻さない。失敗確定はpoll cron経由でのみ行う。
      if (row.gmo_apply_no != null) return false

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

function buildTransferRequestPayload(withdrawal: WithdrawalForSubmit): TransferRequest {
  const accountId = process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID
  if (!accountId) throw new Error('GMO_AOZORA_REMITTER_ACCOUNT_ID is required')

  const snapshot = withdrawal.bank_snapshot
  const beneficiaryName = snapshot.accountHolderNameKana ?? snapshot.accountHolderName

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
        beneficiaryBankCode: snapshot.bankCode,
        beneficiaryBranchCode: snapshot.branchCode,
        accountTypeCode: snapshot.accountType === 'CURRENT' ? '2' : '1',
        accountNumber: snapshot.accountNumber,
        beneficiaryName,
      },
    ],
  }
}
