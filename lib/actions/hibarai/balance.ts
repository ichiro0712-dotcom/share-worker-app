// 'use server' にしない。getMoneyHomeData(workerId)/getWorkerHistory(workerId) を公開アクション露出させない
// （露出すると任意 workerId で他人の残高・履歴を取得できるIDORになる）。
// ワーカー画面(W1/W2/W5)は Server Component で getAuthenticatedUser().id を渡してサーバーサイドで呼ぶ。
import { Prisma } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import type { BankAccountSummary, WorkerHistoryItem } from '@/lib/dummy-data/hibarai'
import { createHibaraiAuditLog } from './audit'
import { getJSTSettlementMonthStart } from './utils'
import { getEffectiveWithdrawalFee } from './settings'

export type MoneyHomeData = {
  availableAmount: number
  reviewUnlockAmount: number
  scheduledPaymentAmount: number
  fee: number
  deadlineText: string
  scheduledPaymentDate: string
  // 口座未登録でも既定オブジェクト(status:'unregistered')を返すため null にはならない
  bankAccount: BankAccountSummary & { id: string | null }
  history: WorkerHistoryItem[]
  policy: {
    rateBasisPoints: number
    perRequestLimitAmount: number | null
    dailyLimitAmount: number | null
    monthlyLimitAmount: number | null
    isSuspended: boolean
  }
}

export async function getMoneyHomeData(workerId: number): Promise<MoneyHomeData> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  const balance = await prisma.pointBalance.upsert({
    where: { worker_id: workerId },
    create: { worker_id: workerId, balance: 0, total_charged: 0, total_withdrawn: 0 },
    update: {},
  })
  const now = new Date()
  const [bankAccount, policy, reviewCandidates, scheduledPayment, historyRows] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { userId: workerId } }),
    prisma.advancePaymentPolicy.findFirst({
      where: {
        worker_id: workerId,
        effective_from: { lte: now },
        OR: [{ effective_to: null }, { effective_to: { gt: now } }],
      },
      orderBy: { effective_from: 'desc' },
    }),
    prisma.attendance.findMany({
      where: {
        user_id: workerId,
        calculated_wage: { not: null },
        pointLedgerEntries: { none: { kind: 'ATTENDANCE_CONFIRMED' } },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { id: true, calculated_wage: true },
    }),
    prisma.pointLedgerEntry.aggregate({
      where: {
        worker_id: workerId,
        // 当月精算分のみ。前月以前は月末スイープで給与口座へ振替済み想定。
        settlement_month: getJSTSettlementMonthStart(now),
        // チャージ + 勤怠修正の差額調整(source_type=AttendanceWageAdjustment)のみ合算。
        // 他用途のMANUAL_ADJUSTMENTを巻き込まない（review-trigger.ts の ADJUSTMENT_SOURCE_TYPE と一致）。
        OR: [
          { kind: 'ATTENDANCE_CONFIRMED' },
          { kind: 'MANUAL_ADJUSTMENT', source_type: 'AttendanceWageAdjustment' },
        ],
      },
      _sum: { scheduled_payment_amount: true },
    }),
    prisma.pointLedgerEntry.findMany({
      where: { worker_id: workerId },
      orderBy: { created_at: 'desc' },
      take: 3,
      select: { id: true, kind: true, delta: true, note: true, created_at: true },
    }),
  ])

  const rate = policy?.rate_basis_points ?? 9000
  const reviewUnlockAmount = reviewCandidates.reduce((total, attendance) => {
    const wage = attendance.calculated_wage ?? 0
    return total + Math.floor(wage * rate / 10000)
  }, 0)

  const fee = await getEffectiveWithdrawalFee()

  return {
    availableAmount: balance.balance,
    reviewUnlockAmount,
    scheduledPaymentAmount: scheduledPayment._sum.scheduled_payment_amount ?? 0,
    fee,
    deadlineText: buildDeadlineText(now),
    scheduledPaymentDate: buildScheduledPaymentDate(now),
    bankAccount: bankAccount
      ? {
          id: bankAccount.id,
          bankName: bankAccount.bankName,
          branchName: bankAccount.branchName,
          last4: bankAccount.accountNumber.slice(-4),
          status: bankAccount.cooldownUntil && bankAccount.cooldownUntil > now
            ? 'cooldown'
            : bankAccount.isVerified
              ? 'verified'
              : 'blocked',
        }
      : {
          id: null,
          bankName: '未登録',
          branchName: '-',
          last4: '----',
          status: 'unregistered',
        },
    history: historyRows.map((row) => ({
      id: row.id,
      date: row.created_at.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }),
      title: getHistoryTitle(row.kind),
      status: getHistoryStatus(row.kind),
      amount: row.delta,
      note: row.note ?? '',
    })),
    policy: {
      rateBasisPoints: rate,
      perRequestLimitAmount: policy?.per_request_limit_amount ?? null,
      dailyLimitAmount: policy?.daily_limit_amount ?? null,
      monthlyLimitAmount: policy?.monthly_limit_amount ?? null,
      isSuspended: policy?.is_suspended ?? false,
    },
  }
}

export async function recomputeBalance(workerId: number): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  await prisma.$transaction(
    async (tx) => {
      await tx.pointBalance.upsert({
        where: { worker_id: workerId },
        create: { worker_id: workerId, balance: 0, total_charged: 0, total_withdrawn: 0 },
        update: {},
      })
      const locked = await tx.$queryRaw<{ balance: number }[]>`
        SELECT balance FROM point_balances WHERE worker_id = ${workerId} FOR UPDATE
      `
      if (locked.length === 0) throw new Error('PointBalance not found')

      const [balanceSum, chargedSum, withdrawnSum] = await Promise.all([
        tx.pointLedgerEntry.aggregate({ where: { worker_id: workerId }, _sum: { delta: true } }),
        tx.pointLedgerEntry.aggregate({
          where: { worker_id: workerId, kind: 'ATTENDANCE_CONFIRMED' },
          _sum: { delta: true },
        }),
        tx.pointLedgerEntry.aggregate({
          where: { worker_id: workerId, kind: 'WITHDRAWAL_RESERVED' },
          _sum: { delta: true },
        }),
      ])
      const nextBalance = balanceSum._sum.delta ?? 0
      await tx.pointBalance.update({
        where: { worker_id: workerId },
        data: {
          balance: nextBalance,
          total_charged: chargedSum._sum.delta ?? 0,
          total_withdrawn: Math.abs(withdrawnSum._sum.delta ?? 0),
        },
      })
      await createHibaraiAuditLog(tx, {
        actorType: 'SYSTEM_CRON',
        action: 'BALANCE_RECOMPUTED',
        targetType: 'PointBalance',
        targetId: String(workerId),
        idempotencyKey: `recompute-${workerId}-${Date.now()}`,
        payload: { workerId, balance: nextBalance } as Prisma.InputJsonValue,
        result: 'SUCCESS',
      })
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    }
  )
}

function getHistoryTitle(kind: string): string {
  if (kind === 'ATTENDANCE_CONFIRMED') return 'チャージ'
  if (kind === 'WITHDRAWAL_RESERVED') return '申請受付'
  if (kind === 'WITHDRAWAL_COMPLETED') return '振込完了'
  if (kind === 'WITHDRAWAL_REVERTED') return '返却'
  return '残高調整'
}

function getHistoryStatus(kind: string): WorkerHistoryItem['status'] {
  if (kind === 'ATTENDANCE_CONFIRMED') return 'charged'
  if (kind === 'WITHDRAWAL_COMPLETED') return 'completed'
  if (kind === 'WITHDRAWAL_REVERTED') return 'failed'
  return 'accepted'
}

/** 現在のJST月の月末締切テキスト。 */
function buildDeadlineText(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value) // 1-12
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${m}月${lastDay}日 23:59まで受け取りできます`
}

/** 翌月15日（給与日想定）のテキスト。 */
function buildScheduledPaymentDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' }).formatToParts(now)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const nextMonth = m === 12 ? 1 : m + 1
  return `${nextMonth}月15日`
}

/** W5用: ワーカーの支払い履歴（台帳）を新しい順に取得する。 */
export async function getWorkerHistory(workerId: number, limit = 100): Promise<WorkerHistoryItem[]> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')
  const rows = await prisma.pointLedgerEntry.findMany({
    where: { worker_id: workerId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { id: true, kind: true, delta: true, note: true, created_at: true },
  })
  return rows.map((row) => ({
    id: row.id,
    date: row.created_at.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }),
    title: getHistoryTitle(row.kind),
    status: getHistoryStatus(row.kind),
    amount: row.delta,
    note: row.note ?? '',
  }))
}
