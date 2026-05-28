import assert from 'node:assert/strict'
import test from 'node:test'

import { gmoBalanceLevel, parseFee, parseThresholds, resolveEffectiveFee, DEFAULT_GMO_THRESHOLDS } from '../settings'

const T = { caution: 1_000_000, warning: 500_000, critical: 200_000 }

test('GMO残高レベル判定', () => {
  assert.equal(gmoBalanceLevel(2_000_000, T), 'ok')
  assert.equal(gmoBalanceLevel(1_000_000, T), 'ok') // ちょうど注意閾値は ok（未満で発火）
  assert.equal(gmoBalanceLevel(999_999, T), 'caution')
  assert.equal(gmoBalanceLevel(500_000, T), 'caution')
  assert.equal(gmoBalanceLevel(499_999, T), 'warning')
  assert.equal(gmoBalanceLevel(200_000, T), 'warning')
  assert.equal(gmoBalanceLevel(199_999, T), 'critical')
  assert.equal(gmoBalanceLevel(0, T), 'critical')
})

test('手数料パース', () => {
  assert.equal(parseFee('143'), 143)
  assert.equal(parseFee('0'), 0)
  assert.equal(parseFee(''), null)
  assert.equal(parseFee('abc'), null)
  assert.equal(parseFee('-5'), null)
  assert.equal(parseFee('1.5'), null)
  assert.equal(parseFee(null), null)
})

test('有効手数料の解決: 0/不正は無料出金を避けてfallback', () => {
  assert.equal(resolveEffectiveFee(143, 200), 143)
  assert.equal(resolveEffectiveFee(0, 143), 143) // 0は無料出金になるのでfallback
  assert.equal(resolveEffectiveFee(null, 143), 143)
  assert.equal(resolveEffectiveFee(1, 143), 1)
})

test('閾値パース: 正常JSON', () => {
  const t = parseThresholds(JSON.stringify({ caution: 900000, warning: 400000, critical: 100000 }))
  assert.deepEqual(t, { caution: 900000, warning: 400000, critical: 100000 })
})

test('閾値パース: 不正/欠落はデフォルト補完', () => {
  assert.deepEqual(parseThresholds(null), DEFAULT_GMO_THRESHOLDS)
  assert.deepEqual(parseThresholds('not-json'), DEFAULT_GMO_THRESHOLDS)
  const partial = parseThresholds(JSON.stringify({ caution: 900000 }))
  assert.equal(partial.caution, 900000)
  assert.equal(partial.warning, DEFAULT_GMO_THRESHOLDS.warning)
  assert.equal(partial.critical, DEFAULT_GMO_THRESHOLDS.critical)
})
