import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_ADJUSTMENT_JPY, MIN_REASON_LENGTH, validateAdjustment } from '../manual-adjustment'

test('validateAdjustment: 正常（増額・減額とも可、方向は問わない）', () => {
  assert.deepEqual(validateAdjustment({ workerId: 1, amount: 1000, reason: '返金対応のため調整' }), { ok: true })
  assert.deepEqual(validateAdjustment({ workerId: 1, amount: -500, reason: '誤チャージの取消対応' }), { ok: true })
})

test('validateAdjustment: 金額は0以外の整数', () => {
  assert.equal(validateAdjustment({ workerId: 1, amount: 0, reason: '理由テキスト' }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1, amount: 1.5, reason: '理由テキスト' }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1, amount: Number.NaN, reason: '理由テキスト' }).ok, false)
})

test('validateAdjustment: 1回の上限(±MAX)を超えると不可', () => {
  assert.equal(validateAdjustment({ workerId: 1, amount: MAX_ADJUSTMENT_JPY, reason: '理由テキスト' }).ok, true)
  assert.equal(validateAdjustment({ workerId: 1, amount: MAX_ADJUSTMENT_JPY + 1, reason: '理由テキスト' }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1, amount: -(MAX_ADJUSTMENT_JPY + 1), reason: '理由テキスト' }).ok, false)
})

test('validateAdjustment: 理由は最低文字数が必要（空白のみ不可）', () => {
  assert.equal(validateAdjustment({ workerId: 1, amount: 1000, reason: 'x'.repeat(MIN_REASON_LENGTH - 1) }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1, amount: 1000, reason: '   ' }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1, amount: 1000, reason: 'x'.repeat(MIN_REASON_LENGTH) }).ok, true)
})

test('validateAdjustment: workerId は正の整数', () => {
  assert.equal(validateAdjustment({ workerId: 0, amount: 1000, reason: '理由テキスト' }).ok, false)
  assert.equal(validateAdjustment({ workerId: -3, amount: 1000, reason: '理由テキスト' }).ok, false)
  assert.equal(validateAdjustment({ workerId: 1.2, amount: 1000, reason: '理由テキスト' }).ok, false)
})
