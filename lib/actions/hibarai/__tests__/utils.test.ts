import assert from 'node:assert/strict'
import test from 'node:test'

import { getJSTSettlementMonthStart, toJSTSettlementMonthStart } from '../utils'

// @db.Date は UTC のカレンダー日付として保存されるため、
// 返り値は「UTC で YYYY-MM-01 00:00:00」になっていることを確認する。
function assertUtcMonthStart(actual: Date, year: number, month1to12: number): void {
  assert.equal(actual.getUTCFullYear(), year)
  assert.equal(actual.getUTCMonth(), month1to12 - 1)
  assert.equal(actual.getUTCDate(), 1)
  assert.equal(actual.getUTCHours(), 0)
  assert.equal(actual.getUTCMinutes(), 0)
  assert.equal(actual.getUTCSeconds(), 0)
  assert.equal(actual.getUTCMilliseconds(), 0)
}

test('JST月初の境界: 5/1 02:00 JST は5月扱い', () => {
  // 2026-05-01 02:00 JST = 2026-04-30 17:00 UTC
  const now = new Date('2026-04-30T17:00:00Z')
  assertUtcMonthStart(getJSTSettlementMonthStart(now), 2026, 5)
})

test('JST月初の境界: 6/1 00:30 JST は6月扱い', () => {
  // 2026-06-01 00:30 JST = 2026-05-31 15:30 UTC
  const now = new Date('2026-05-31T15:30:00Z')
  assertUtcMonthStart(getJSTSettlementMonthStart(now), 2026, 6)
})

test('JST月初の境界: 5/31 23:59 JST はまだ5月扱い', () => {
  // 2026-05-31 23:59 JST = 2026-05-31 14:59 UTC
  const now = new Date('2026-05-31T14:59:00Z')
  assertUtcMonthStart(getJSTSettlementMonthStart(now), 2026, 5)
})

test('年跨ぎ: 1/1 00:00 JST は翌年1月扱い', () => {
  // 2026-01-01 00:00 JST = 2025-12-31 15:00 UTC
  const now = new Date('2025-12-31T15:00:00Z')
  assertUtcMonthStart(getJSTSettlementMonthStart(now), 2026, 1)
})

test('toJSTSettlementMonthStart は任意日時の属するJST月初を返す', () => {
  // 勤務開始 2026-05-01 02:00 JST = 2026-04-30 17:00 UTC → 5月
  const workDate = new Date('2026-04-30T17:00:00Z')
  assertUtcMonthStart(toJSTSettlementMonthStart(workDate), 2026, 5)
})
