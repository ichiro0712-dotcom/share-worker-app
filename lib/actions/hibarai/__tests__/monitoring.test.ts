import assert from 'node:assert/strict'
import test from 'node:test'

import { bucketAges, DEFAULT_AGE_BUCKETS, hoursBetween } from '../monitoring'

test('hoursBetween: 2点間の時間差(hour)', () => {
  const a = new Date('2026-05-30T10:00:00Z')
  const b = new Date('2026-05-30T11:30:00Z')
  assert.equal(hoursBetween(a, b), 1.5)
})

test('bucketAges: 空配列は全バケットゼロ', () => {
  const r = bucketAges([], DEFAULT_AGE_BUCKETS)
  assert.equal(r.length, DEFAULT_AGE_BUCKETS.length)
  for (const b of r) assert.equal(b.count, 0)
})

test('bucketAges: 境界(maxHours以下)は前バケットに入る', () => {
  // DEFAULT: 〜1h, 1〜6h, 6〜24h, 24h超
  const r = bucketAges([0.5, 1, 1.01, 6, 6.01, 24, 25], DEFAULT_AGE_BUCKETS)
  // 0.5,1 → 〜1h(2件) / 1.01,6 → 1〜6h(2件) / 6.01,24 → 6〜24h(2件) / 25 → 24h超(1件)
  assert.deepEqual(r.map((b) => b.count), [2, 2, 2, 1])
})

test('bucketAges: catch-all (maxHours=null) は最後のバケット', () => {
  const buckets = [
    { label: '〜2h', maxHours: 2 },
    { label: '超', maxHours: null },
  ]
  assert.deepEqual(bucketAges([1, 3, 100], buckets).map((b) => b.count), [1, 2])
})

test('bucketAges: ageは正のみ想定。負値は最初のバケットへ（保守的）', () => {
  // 通常 ageHours は非負だが、システム時計のズレ等で稀に負になっても安全に最初のバケットへ落とす。
  const r = bucketAges([-1], DEFAULT_AGE_BUCKETS)
  assert.equal(r[0].count, 1)
})
