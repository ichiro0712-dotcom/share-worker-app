import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSupportCode,
  deriveErrorType,
  ERROR_QUEUE_WHERE,
  mapWithdrawalToErrorItem,
} from '../admin-errors'

test('deriveErrorType: GMO状態コードがあれば正規ラベルを優先', () => {
  assert.equal(deriveErrorType({ gmoStatusCode: 22, gmoStatusName: 'なにか', errorCode: 'E1' }), '資金返却')
  assert.equal(deriveErrorType({ gmoStatusCode: 26, gmoStatusName: null, errorCode: null }), '組戻不成立')
})

test('deriveErrorType: 未知コードは不明(code)', () => {
  assert.equal(deriveErrorType({ gmoStatusCode: 99, gmoStatusName: null, errorCode: null }), '不明(99)')
})

test('deriveErrorType: コードなしは status名→errorCode→既定の順', () => {
  assert.equal(deriveErrorType({ gmoStatusCode: null, gmoStatusName: '口座名義不一致', errorCode: 'X' }), '口座名義不一致')
  assert.equal(deriveErrorType({ gmoStatusCode: null, gmoStatusName: null, errorCode: 'ACCOUNT_INVALID' }), 'ACCOUNT_INVALID')
  assert.equal(deriveErrorType({ gmoStatusCode: null, gmoStatusName: null, errorCode: null }), '振込エラー')
})

test('ERROR_QUEUE_WHERE: FAILED/REFUNDED に加え GMO組戻不成立(26)を含む', () => {
  const or = ERROR_QUEUE_WHERE.OR as Array<Record<string, unknown>>
  assert.ok(Array.isArray(or))
  // 26 ブランチ（COMPLETED永続の高リスク行を取りこぼさない）
  assert.ok(or.some((c) => c.gmo_transfer_status_code === 26))
  // FAILED/REFUNDED ブランチ
  const statusBranch = or.find((c) => (c.status as { in?: unknown[] } | undefined)?.in) as
    | { status: { in: string[] } }
    | undefined
  assert.ok(statusBranch)
  assert.deepEqual(statusBranch.status.in, ['FAILED', 'REFUNDED'])
})

test('buildSupportCode: 出金IDの末尾6桁から安定コードを生成', () => {
  assert.equal(buildSupportCode('clxabc123456'), 'HB-123456')
  assert.equal(buildSupportCode('abcDEF'), 'HB-ABCDEF')
})

test('mapWithdrawalToErrorItem: 実行行を表示用アイテムへ変換（状態は一律 new）', () => {
  const item = mapWithdrawalToErrorItem({
    id: 'wd_clx000aaa111',
    worker_id: 1024,
    workerName: '高橋 美咲',
    requested_amount: 12000,
    gmo_transfer_status_code: 40,
    gmo_transfer_status_name: '手続不成立',
    error_code: 'E40',
    failed_at: new Date('2026-05-27T01:12:00Z'), // JST 10:12
    refunded_at: null,
    requested_at: new Date('2026-05-20T00:00:00Z'),
  })
  assert.equal(item.id, 'wd_clx000aaa111')
  assert.equal(item.workerId, '1024')
  assert.equal(item.workerName, '高橋 美咲')
  assert.equal(item.errorType, '手続不成立')
  assert.equal(item.amount, 12000)
  assert.equal(item.status, 'new')
  assert.equal(item.supportCode, 'HB-AAA111') // 末尾6桁 'aaa111' を大文字化
  assert.match(item.occurredAt, /2026\/5\/27/) // failed_at 優先
})

test('mapWithdrawalToErrorItem: 組戻不成立(26・COMPLETED永続)も組戻不成立ラベルで new 表示、workerName欠落はID表記', () => {
  const recallFailed = mapWithdrawalToErrorItem({
    id: 'x123abcdef',
    worker_id: 7,
    workerName: null,
    requested_amount: 5000,
    gmo_transfer_status_code: 26,
    gmo_transfer_status_name: '組戻不成立',
    error_code: null,
    failed_at: null,
    refunded_at: null,
    requested_at: new Date('2026-05-10T02:00:00Z'), // JST 11:00
  })
  assert.equal(recallFailed.workerName, 'ID:7')
  assert.equal(recallFailed.errorType, '組戻不成立')
  assert.equal(recallFailed.status, 'new')
  assert.match(recallFailed.occurredAt, /2026\/5\/10/) // failed_at/refunded_at が null なら requested_at
})
