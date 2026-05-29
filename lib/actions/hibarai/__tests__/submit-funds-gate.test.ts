import assert from 'node:assert/strict'
import test from 'node:test'

import { planFundedSubmissions } from '../submit-funds-gate'

test('planFundedSubmissions: availableFunds=null は資金ゲートなし（全件送信）', () => {
  const r = planFundedSubmissions([{ id: 'a', transferAmount: 5000 }, { id: 'b', transferAmount: 9000 }], null)
  assert.deepEqual(r, { submit: ['a', 'b'], skipped: [] })
})

test('planFundedSubmissions: 残高0は全件スキップ（未送金据え置き）', () => {
  const r = planFundedSubmissions([{ id: 'a', transferAmount: 5000 }, { id: 'b', transferAmount: 1 }], 0)
  assert.deepEqual(r, { submit: [], skipped: ['a', 'b'] })
})

test('planFundedSubmissions: 厳格FIFO（賄えない依頼以降は追い越させず全スキップ）', () => {
  const r = planFundedSubmissions(
    [{ id: 'a', transferAmount: 6000 }, { id: 'b', transferAmount: 5000 }, { id: 'c', transferAmount: 3000 }],
    10000,
  )
  // a(6000,残4000) → b(5000>4000)で停止 → b,c は後続なのでスキップ（cは賄えるが追い越さない）
  assert.deepEqual(r, { submit: ['a'], skipped: ['b', 'c'] })
})

test('planFundedSubmissions: 飢餓防止（古い大額が払えない間、後続の小額は追い越さない）', () => {
  const r = planFundedSubmissions(
    [{ id: 'big', transferAmount: 10000 }, { id: 'small', transferAmount: 3000 }],
    3000,
  )
  assert.deepEqual(r, { submit: [], skipped: ['big', 'small'] })
})

test('planFundedSubmissions: ちょうど使い切る / 空配列', () => {
  assert.deepEqual(planFundedSubmissions([{ id: 'a', transferAmount: 10000 }], 10000), { submit: ['a'], skipped: [] })
  assert.deepEqual(planFundedSubmissions([], 10000), { submit: [], skipped: [] })
})
