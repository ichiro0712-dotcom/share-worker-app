import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWithdrawalStatusWhere,
  mapWithdrawalStatus,
  resolveWithdrawalOrderBy,
  summarizeWithdrawals,
  type AdminWithdrawalRow,
} from '../admin-withdrawals'

test('resolveWithdrawalOrderBy: ホワイトリストキーをPrisma orderByへ、未知は申請日時降順', () => {
  assert.deepEqual(resolveWithdrawalOrderBy('amount', 'asc'), { requested_amount: 'asc' })
  assert.deepEqual(resolveWithdrawalOrderBy('completedAt', 'desc'), { completed_at: 'desc' })
  assert.deepEqual(resolveWithdrawalOrderBy('worker', null), { worker_id: 'desc' })
  // 未知のsortは既定(requested_at desc)、未知のorderはdesc
  assert.deepEqual(resolveWithdrawalOrderBy('__evil__', 'sideways'), { requested_at: 'desc' })
  assert.deepEqual(resolveWithdrawalOrderBy(null, 'asc'), { requested_at: 'asc' })
  // 継承プロパティ(toString/constructor/__proto__)はすり抜けず既定にフォールバック
  assert.deepEqual(resolveWithdrawalOrderBy('toString', 'desc'), { requested_at: 'desc' })
  assert.deepEqual(resolveWithdrawalOrderBy('constructor', 'asc'), { requested_at: 'asc' })
  assert.deepEqual(resolveWithdrawalOrderBy('__proto__', 'desc'), { requested_at: 'desc' })
})

test('buildWithdrawalStatusWhere: UIフィルタ→DB状態集合、all/未知は絞り込みなし', () => {
  assert.deepEqual(buildWithdrawalStatusWhere('completed'), { status: { in: ['COMPLETED'] } })
  assert.deepEqual(buildWithdrawalStatusWhere('accepted'), { status: { in: ['PENDING', 'DRAFT'] } })
  assert.deepEqual(buildWithdrawalStatusWhere('failed'), { status: { in: ['FAILED', 'REFUNDED', 'CANCELLED'] } })
  assert.deepEqual(buildWithdrawalStatusWhere('all'), {})
  assert.deepEqual(buildWithdrawalStatusWhere(null), {})
  assert.deepEqual(buildWithdrawalStatusWhere('__evil__'), {})
  // 継承プロパティはすり抜けず絞り込みなし
  assert.deepEqual(buildWithdrawalStatusWhere('toString'), {})
  assert.deepEqual(buildWithdrawalStatusWhere('__proto__'), {})
})

test('DB状態→UI状態マップ', () => {
  assert.equal(mapWithdrawalStatus('COMPLETED'), 'completed')
  assert.equal(mapWithdrawalStatus('PROCESSING'), 'processing')
  assert.equal(mapWithdrawalStatus('PENDING'), 'accepted')
  assert.equal(mapWithdrawalStatus('DRAFT'), 'accepted')
  assert.equal(mapWithdrawalStatus('FAILED'), 'failed')
  assert.equal(mapWithdrawalStatus('REFUNDED'), 'failed')
  assert.equal(mapWithdrawalStatus('CANCELLED'), 'failed')
})

function row(over: Partial<AdminWithdrawalRow>): AdminWithdrawalRow {
  return {
    id: 'w', workerId: 1, workerName: 'A', requestedAmount: 1000, feeAmount: 143, transferAmount: 857,
    status: 'completed', rawStatus: 'COMPLETED', requestedAt: '', completedAt: null,
    bankName: '銀行', accountLast4: '1234', gmoApplyNo: null, settlementMonth: '', errorMessage: null,
    ...over,
  }
}

test('サマリ: 件数・状態別・合計額', () => {
  const rows = [
    row({ status: 'completed', requestedAmount: 1000 }),
    row({ status: 'completed', requestedAmount: 2000 }),
    row({ status: 'processing', requestedAmount: 500 }),
    row({ status: 'failed', requestedAmount: 800 }),
    row({ status: 'accepted', requestedAmount: 300 }),
  ]
  const s = summarizeWithdrawals(rows)
  assert.equal(s.total, 5)
  assert.equal(s.byStatus.completed, 2)
  assert.equal(s.byStatus.processing, 1)
  assert.equal(s.byStatus.failed, 1)
  assert.equal(s.byStatus.accepted, 1)
  assert.equal(s.totalRequestedAmount, 4600)
})

test('サマリ: 空配列', () => {
  const s = summarizeWithdrawals([])
  assert.equal(s.total, 0)
  assert.equal(s.totalRequestedAmount, 0)
  assert.equal(s.byStatus.completed, 0)
})
