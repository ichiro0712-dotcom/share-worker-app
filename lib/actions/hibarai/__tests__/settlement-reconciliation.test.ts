import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateSettlementRows,
  buildSettlementCsv,
  formatSettlementMonthLabel,
  isInflightStatus,
  isMoneyOutStatus,
  parseSettlementMonthParam,
  toSettlementMonthParam,
  type SettlementSourceRow,
} from '../settlement-reconciliation'

test('isMoneyOutStatus: COMPLETED のみ資金流出（26組戻不成立もCOMPLETED永続なので含む）', () => {
  assert.equal(isMoneyOutStatus('COMPLETED'), true)
  assert.equal(isMoneyOutStatus('PROCESSING'), false)
  assert.equal(isMoneyOutStatus('FAILED'), false)
  assert.equal(isMoneyOutStatus('REFUNDED'), false)
  assert.equal(isMoneyOutStatus('CANCELLED'), false)
})

test('isInflightStatus: PROCESSING/PENDING は確定待ち', () => {
  assert.equal(isInflightStatus('PROCESSING'), true)
  assert.equal(isInflightStatus('PENDING'), true)
  assert.equal(isInflightStatus('COMPLETED'), false)
  assert.equal(isInflightStatus('DRAFT'), false)
})

test('parseSettlementMonthParam: "YYYY-MM"→JST月初(UTC日付)、不正はnull', () => {
  const d = parseSettlementMonthParam('2026-05')
  assert.ok(d)
  assert.equal(d.getTime(), Date.UTC(2026, 4, 1))
  assert.equal(parseSettlementMonthParam('2026-13'), null)
  assert.equal(parseSettlementMonthParam('2026-00'), null)
  assert.equal(parseSettlementMonthParam('bad'), null)
  assert.equal(parseSettlementMonthParam(null), null)
})

test('toSettlementMonthParam / formatSettlementMonthLabel', () => {
  const d = new Date(Date.UTC(2026, 4, 1))
  assert.equal(toSettlementMonthParam(d), '2026-05')
  assert.equal(formatSettlementMonthLabel(d), '2026年5月')
})

function src(over: Partial<SettlementSourceRow>): SettlementSourceRow {
  return {
    workerId: 1,
    workerName: 'A',
    status: 'COMPLETED',
    requestedAmount: 10000,
    feeAmount: 143,
    transferAmount: 9857,
    ...over,
  }
}

test('aggregateSettlementRows: ワーカー別に完了/確定待ちを集計、失敗は除外', () => {
  const rows: SettlementSourceRow[] = [
    src({ workerId: 7, workerName: '高橋', status: 'COMPLETED', requestedAmount: 10000, feeAmount: 143, transferAmount: 9857 }),
    src({ workerId: 7, workerName: '高橋', status: 'COMPLETED', requestedAmount: 5000, feeAmount: 143, transferAmount: 4857 }),
    src({ workerId: 7, workerName: '高橋', status: 'PROCESSING', requestedAmount: 3000, feeAmount: 143, transferAmount: 2857 }),
    src({ workerId: 7, workerName: '高橋', status: 'FAILED', requestedAmount: 9999, feeAmount: 143, transferAmount: 9856 }),
    src({ workerId: 3, workerName: '佐藤', status: 'COMPLETED', requestedAmount: 2000, feeAmount: 143, transferAmount: 1857 }),
  ]
  const { rows: agg, summary } = aggregateSettlementRows(rows)

  // 申請額合計の大きい順（高橋15000 > 佐藤2000）
  assert.equal(agg[0].workerId, 7)
  assert.equal(agg[0].completedCount, 2)
  assert.equal(agg[0].requestedTotal, 15000)
  assert.equal(agg[0].feeTotal, 286)
  assert.equal(agg[0].transferTotal, 14714)
  assert.equal(agg[0].inflightCount, 1)
  assert.equal(agg[0].inflightRequestedTotal, 3000)

  assert.equal(agg[1].workerId, 3)
  assert.equal(agg[1].requestedTotal, 2000)

  // サマリ（FAILEDは金額に含めない）
  assert.equal(summary.workerCount, 2)
  assert.equal(summary.completedCount, 3)
  assert.equal(summary.requestedTotal, 17000)
  assert.equal(summary.feeTotal, 429)
  assert.equal(summary.transferTotal, 16571)
  assert.equal(summary.inflightCount, 1)
  assert.equal(summary.inflightRequestedTotal, 3000)
})

test('aggregateSettlementRows: 失敗のみのワーカーは完了0件でも行に出す（要確認のため）', () => {
  const { rows } = aggregateSettlementRows([src({ workerId: 9, workerName: 'X', status: 'FAILED' })])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].completedCount, 0)
  assert.equal(rows[0].requestedTotal, 0)
})

test('aggregateSettlementRows: REFUNDED/CANCELLED/DRAFT は金額に含めず、PENDINGは確定待ち', () => {
  const rows: SettlementSourceRow[] = [
    src({ workerId: 1, status: 'COMPLETED', requestedAmount: 8000, feeAmount: 143, transferAmount: 7857 }),
    src({ workerId: 1, status: 'REFUNDED', requestedAmount: 1000 }),
    src({ workerId: 1, status: 'CANCELLED', requestedAmount: 1000 }),
    src({ workerId: 1, status: 'DRAFT', requestedAmount: 1000 }),
    src({ workerId: 1, status: 'PENDING', requestedAmount: 2500 }),
  ]
  const { rows: agg, summary } = aggregateSettlementRows(rows)
  assert.equal(agg.length, 1)
  assert.equal(agg[0].completedCount, 1)
  assert.equal(agg[0].requestedTotal, 8000) // REFUNDED/CANCELLED/DRAFT は除外
  assert.equal(agg[0].inflightCount, 1) // PENDING のみ
  assert.equal(agg[0].inflightRequestedTotal, 2500)
  // 完了行の不変条件: 申請額合計 = 手数料合計 + 実振込額合計
  assert.equal(summary.requestedTotal, summary.feeTotal + summary.transferTotal)
})

test('buildSettlementCsv: ヘッダ＋ワーカー行、危険な名前をエスケープ', () => {
  const { rows } = aggregateSettlementRows([
    src({ workerId: 7, workerName: '=cmd,x', status: 'COMPLETED', requestedAmount: 10000, feeAmount: 143, transferAmount: 9857 }),
  ])
  const csv = buildSettlementCsv(rows)
  const lines = csv.split('\r\n')
  assert.match(lines[0], /ワーカーID/)
  assert.match(lines[0], /申請額合計/)
  assert.equal(lines[1].split(',').length >= 7, true)
  assert.match(lines[1], /"'=cmd,x"/) // CSVインジェクション対策
})
