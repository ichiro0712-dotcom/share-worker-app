import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWithdrawalFailedVariables,
  buildWithdrawalSupportCode,
  shouldNotifyWithdrawalFailure,
} from '../failure-notification'

test('shouldNotifyWithdrawalFailure: FAILEDのみ通知（26/COMPLETED/PROCESSING等は通知しない）', () => {
  assert.equal(shouldNotifyWithdrawalFailure('FAILED'), true)
  assert.equal(shouldNotifyWithdrawalFailure('COMPLETED'), false) // 組戻不成立26もCOMPLETED永続
  assert.equal(shouldNotifyWithdrawalFailure('PROCESSING'), false)
  assert.equal(shouldNotifyWithdrawalFailure('PENDING'), false)
  assert.equal(shouldNotifyWithdrawalFailure('REFUNDED'), false)
  assert.equal(shouldNotifyWithdrawalFailure('CANCELLED'), false)
})

test('buildWithdrawalSupportCode: 末尾6桁を大文字化（A3と同形式）', () => {
  assert.equal(buildWithdrawalSupportCode('wd_clx000aaa111'), 'HB-AAA111')
  assert.equal(buildWithdrawalSupportCode('abcDEF'), 'HB-ABCDEF')
})

test('buildWithdrawalFailedVariables: 金額はカンマ区切り、テンプレ変数キーを揃える', () => {
  const v = buildWithdrawalFailedVariables({
    workerName: '高橋 美咲',
    amount: 12000,
    supportCode: 'HB-ABC123',
    accountUrl: 'https://tastas.work/mypage/money/withdrawals/wd_1/error',
  })
  assert.equal(v.worker_name, '高橋 美咲')
  assert.equal(v.amount, '12,000')
  assert.equal(v.support_code, 'HB-ABC123')
  assert.equal(v.account_url, 'https://tastas.work/mypage/money/withdrawals/wd_1/error')
  // プッシュのタップ遷移先（notification-service が resubmit_url を参照）
  assert.equal(v.resubmit_url, v.account_url)
})
