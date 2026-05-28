import assert from 'node:assert/strict'
import test from 'node:test'

import { mapWithdrawalStatus, summarizeWithdrawals, type AdminWithdrawalRow } from '../admin-withdrawals'

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
