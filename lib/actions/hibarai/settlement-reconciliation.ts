// 給与控除リコンサイル(精算月×ワーカーの立替集計)。'use server'にしない（Server Componentから呼ぶ）。
// 経理/報酬チームが「当月の立替総額」を給与控除と相殺するための事実集計。
// 控除額の確定算定式(算定母数・手数料負担)は経理側で未確定(P0)のため、ここでは特定の控除ルールを
// 作り込まず、申請額/手数料/実振込額の合計をステータス別に提示する。
import { WithdrawalStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { escapeCsvField } from './withdrawals-csv'

/** 資金が流出した（受取人に渡った）状態。26:組戻不成立もCOMPLETED永続なので含まれる。 */
export function isMoneyOutStatus(status: string): boolean {
  return status === WithdrawalStatus.COMPLETED
}

/** 確定待ち（予約済みだが完了/失敗が未確定）。月末締め時点では原則0件想定。 */
export function isInflightStatus(status: string): boolean {
  return status === WithdrawalStatus.PROCESSING || status === WithdrawalStatus.PENDING
}

/** "YYYY-MM" を精算月(JST月初・UTC日付)へ。不正は null（純粋）。 */
export function parseSettlementMonthParam(param: string | null | undefined): Date | null {
  if (!param) return null
  const m = /^(\d{4})-(\d{2})$/.exec(param)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

/** 精算月Date → "YYYY-MM"（settlement_monthはUTC日付保存なのでUTC部品で読む）（純粋）。 */
export function toSettlementMonthParam(monthStart: Date): string {
  const y = monthStart.getUTCFullYear()
  const m = String(monthStart.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** 精算月Date → "YYYY年M月"（純粋）。 */
export function formatSettlementMonthLabel(monthStart: Date): string {
  return `${monthStart.getUTCFullYear()}年${monthStart.getUTCMonth() + 1}月`
}

export type SettlementSourceRow = {
  workerId: number
  workerName: string
  status: string
  requestedAmount: number
  feeAmount: number
  transferAmount: number
}

export type SettlementWorkerRow = {
  workerId: number
  workerName: string
  completedCount: number
  requestedTotal: number
  feeTotal: number
  transferTotal: number
  inflightCount: number
  inflightRequestedTotal: number
}

export type SettlementSummary = {
  workerCount: number
  completedCount: number
  requestedTotal: number
  feeTotal: number
  transferTotal: number
  inflightCount: number
  inflightRequestedTotal: number
}

/** 出金行をワーカー別に集計する（申請額合計の降順）。失敗等は金額に含めない（純粋）。 */
export function aggregateSettlementRows(rows: SettlementSourceRow[]): {
  rows: SettlementWorkerRow[]
  summary: SettlementSummary
} {
  const byWorker = new Map<number, SettlementWorkerRow>()
  for (const r of rows) {
    let w = byWorker.get(r.workerId)
    if (!w) {
      w = {
        workerId: r.workerId,
        workerName: r.workerName,
        completedCount: 0,
        requestedTotal: 0,
        feeTotal: 0,
        transferTotal: 0,
        inflightCount: 0,
        inflightRequestedTotal: 0,
      }
      byWorker.set(r.workerId, w)
    }
    if (isMoneyOutStatus(r.status)) {
      w.completedCount += 1
      w.requestedTotal += r.requestedAmount
      w.feeTotal += r.feeAmount
      w.transferTotal += r.transferAmount
    } else if (isInflightStatus(r.status)) {
      w.inflightCount += 1
      w.inflightRequestedTotal += r.requestedAmount
    }
  }

  const aggregated = Array.from(byWorker.values()).sort(
    (a, b) => b.requestedTotal - a.requestedTotal || a.workerId - b.workerId,
  )

  const summary: SettlementSummary = {
    workerCount: aggregated.length,
    completedCount: 0,
    requestedTotal: 0,
    feeTotal: 0,
    transferTotal: 0,
    inflightCount: 0,
    inflightRequestedTotal: 0,
  }
  for (const w of aggregated) {
    summary.completedCount += w.completedCount
    summary.requestedTotal += w.requestedTotal
    summary.feeTotal += w.feeTotal
    summary.transferTotal += w.transferTotal
    summary.inflightCount += w.inflightCount
    summary.inflightRequestedTotal += w.inflightRequestedTotal
  }

  return { rows: aggregated, summary }
}

const CSV_HEADERS = [
  'ワーカーID',
  'ワーカー名',
  '完了件数',
  '申請額合計',
  '手数料合計',
  '実振込額合計',
  '確定待ち件数',
  '確定待ち申請額合計',
] as const

/** 精算リコンサイルのワーカー別行をCSVへ（純粋）。 */
export function buildSettlementCsv(rows: SettlementWorkerRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.workerId,
        r.workerName,
        r.completedCount,
        r.requestedTotal,
        r.feeTotal,
        r.transferTotal,
        r.inflightCount,
        r.inflightRequestedTotal,
      ]
        .map(escapeCsvField)
        .join(','),
    )
  }
  return lines.join('\r\n')
}

export type SettlementReconciliation = {
  monthStart: Date
  monthParam: string
  monthLabel: string
  rows: SettlementWorkerRow[]
  summary: SettlementSummary
}

/** 指定精算月の立替集計を取得する。 */
export async function getSettlementReconciliation(monthStart: Date): Promise<SettlementReconciliation> {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { settlement_month: monthStart },
    select: {
      worker_id: true,
      status: true,
      requested_amount: true,
      fee_amount: true,
      transfer_amount: true,
      worker: { select: { name: true } },
    },
  })
  const source: SettlementSourceRow[] = withdrawals.map((w) => ({
    workerId: w.worker_id,
    workerName: w.worker?.name ?? `ID:${w.worker_id}`,
    status: w.status,
    requestedAmount: w.requested_amount,
    feeAmount: w.fee_amount,
    transferAmount: w.transfer_amount,
  }))
  const { rows, summary } = aggregateSettlementRows(source)
  return {
    monthStart,
    monthParam: toSettlementMonthParam(monthStart),
    monthLabel: formatSettlementMonthLabel(monthStart),
    rows,
    summary,
  }
}

/** セレクタ用: 出金が存在する精算月を新しい順に列挙する。 */
export async function getAvailableSettlementMonths(limit = 24): Promise<Array<{ param: string; label: string }>> {
  const months = await prisma.withdrawalRequest.findMany({
    distinct: ['settlement_month'],
    select: { settlement_month: true },
    orderBy: { settlement_month: 'desc' },
    take: limit,
  })
  return months.map((m) => ({
    param: toSettlementMonthParam(m.settlement_month),
    label: formatSettlementMonthLabel(m.settlement_month),
  }))
}
