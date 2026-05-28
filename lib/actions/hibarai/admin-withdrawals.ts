// 管理者向け 振込履歴(A5) の読み取り。
// 'use server' にしない（Server Component から呼ぶ純粋なサーバー関数。公開アクションにはしない）。
// クライアントは型のみ import（import type）で参照するため実行時のバンドル流入はない。
import type { WithdrawalStatus } from '@prisma/client'
import prisma from '@/lib/prisma'

/** UI表示用の状態区分 */
export type AdminWithdrawalUiStatus = 'completed' | 'accepted' | 'processing' | 'failed'

/** DBの WithdrawalStatus を UI区分へマップする */
export function mapWithdrawalStatus(status: WithdrawalStatus | string): AdminWithdrawalUiStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'PROCESSING':
      return 'processing'
    case 'PENDING':
    case 'DRAFT':
      return 'accepted'
    case 'FAILED':
    case 'REFUNDED':
    case 'CANCELLED':
    default:
      return 'failed'
  }
}

export type AdminWithdrawalRow = {
  id: string
  workerId: number
  workerName: string
  requestedAmount: number
  feeAmount: number
  transferAmount: number
  status: AdminWithdrawalUiStatus
  rawStatus: string
  requestedAt: string
  completedAt: string | null
  bankName: string
  accountLast4: string
  gmoApplyNo: string | null
  settlementMonth: string
  errorMessage: string | null
}

export type AdminWithdrawalSummary = {
  total: number
  byStatus: Record<AdminWithdrawalUiStatus, number>
  totalRequestedAmount: number
}

/** 行配列からサマリ（件数・状態別件数・合計額）を計算する（純粋関数） */
export function summarizeWithdrawals(rows: AdminWithdrawalRow[]): AdminWithdrawalSummary {
  const byStatus: Record<AdminWithdrawalUiStatus, number> = {
    completed: 0,
    accepted: 0,
    processing: 0,
    failed: 0,
  }
  let totalRequestedAmount = 0
  for (const row of rows) {
    byStatus[row.status] += 1
    totalRequestedAmount += row.requestedAmount
  }
  return { total: rows.length, byStatus, totalRequestedAmount }
}

function jstDateTime(date: Date | null): string | null {
  return date ? date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null
}

type SnapshotShape = { bankCode?: unknown; accountNumber?: unknown }

export type AdminWithdrawalsResult = {
  rows: AdminWithdrawalRow[]
  summary: AdminWithdrawalSummary
}

/**
 * 管理者向けに直近の出金申請を取得する（ワーカー名・銀行名・GMO申込番号・精算月込み）。
 */
export async function getAdminWithdrawals(limit = 200): Promise<AdminWithdrawalsResult> {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { requested_at: 'desc' },
    take: limit,
    include: { worker: { select: { id: true, name: true } } },
  })

  // bank_snapshot の bankCode から銀行名を解決
  const bankCodes = new Set<string>()
  for (const w of withdrawals) {
    const snap = (w.bank_snapshot ?? {}) as SnapshotShape
    if (typeof snap.bankCode === 'string') bankCodes.add(snap.bankCode)
  }
  const banks = bankCodes.size
    ? await prisma.bank.findMany({ where: { code: { in: Array.from(bankCodes) } }, select: { code: true, name: true } })
    : []
  const bankNameByCode = new Map(banks.map((b) => [b.code, b.name]))

  const rows: AdminWithdrawalRow[] = withdrawals.map((w) => {
    const snap = (w.bank_snapshot ?? {}) as SnapshotShape
    const bankCode = typeof snap.bankCode === 'string' ? snap.bankCode : ''
    const accountNumber = typeof snap.accountNumber === 'string' ? snap.accountNumber : ''
    return {
      id: w.id,
      workerId: w.worker_id,
      workerName: w.worker?.name ?? `ID:${w.worker_id}`,
      requestedAmount: w.requested_amount,
      feeAmount: w.fee_amount,
      transferAmount: w.transfer_amount,
      status: mapWithdrawalStatus(w.status),
      rawStatus: w.status,
      requestedAt: jstDateTime(w.requested_at) ?? '',
      completedAt: jstDateTime(w.completed_at),
      bankName: bankNameByCode.get(bankCode) ?? (bankCode ? `銀行コード${bankCode}` : '不明'),
      accountLast4: accountNumber ? accountNumber.slice(-4) : '----',
      gmoApplyNo: w.gmo_apply_no,
      settlementMonth: w.settlement_month
        ? w.settlement_month.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long' })
        : '',
      errorMessage: w.error_message,
    }
  })

  return { rows, summary: summarizeWithdrawals(rows) }
}

export type AdminWithdrawalDetail = {
  id: string
  workerId: number
  workerName: string
  requestedAmount: number
  feeAmount: number
  transferAmount: number
  status: string
  gmoApplyNo: string | null
  gmoTransferStatusName: string | null
  errorMessage: string | null
  attempts: Array<{
    attemptNo: number
    occurredAt: string
    responseStatusCode: number | null
    gmoApplyNo: string | null
    errorCode: string | null
    durationMs: number | null
  }>
}

/**
 * 出金1件の詳細（GMO送信試行ログ含む）を取得する。
 */
export async function getAdminWithdrawalDetail(id: string): Promise<AdminWithdrawalDetail | null> {
  const w = await prisma.withdrawalRequest.findUnique({
    where: { id },
    include: {
      worker: { select: { id: true, name: true } },
      // request_body(口座番号含む)等は読まない。詳細表示に必要な列のみ。
      transfer_attempts: {
        orderBy: { attempt_no: 'asc' },
        select: {
          attempt_no: true,
          occurred_at: true,
          response_status_code: true,
          gmo_apply_no: true,
          error_code: true,
          duration_ms: true,
        },
      },
    },
  })
  if (!w) return null
  return {
    id: w.id,
    workerId: w.worker_id,
    workerName: w.worker?.name ?? `ID:${w.worker_id}`,
    requestedAmount: w.requested_amount,
    feeAmount: w.fee_amount,
    transferAmount: w.transfer_amount,
    status: w.status,
    gmoApplyNo: w.gmo_apply_no,
    gmoTransferStatusName: w.gmo_transfer_status_name,
    errorMessage: w.error_message,
    attempts: w.transfer_attempts.map((a) => ({
      attemptNo: a.attempt_no,
      occurredAt: a.occurred_at.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      responseStatusCode: a.response_status_code,
      gmoApplyNo: a.gmo_apply_no,
      errorCode: a.error_code,
      durationMs: a.duration_ms,
    })),
  }
}
