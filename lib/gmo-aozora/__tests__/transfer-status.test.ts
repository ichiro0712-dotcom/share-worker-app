import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TRANSFER_STATUS_CODES,
  USER_FACING_STATUS_TEXT,
  isBalanceRestorableFailureStatus,
  isFailureStatus,
  isTerminalStatus,
} from '../transfer-status'

test('completed transfer status is terminal', () => {
  assert.equal(isTerminalStatus(TRANSFER_STATUS_CODES.COMPLETED), true)
})

test('failed transfer status is failure', () => {
  assert.equal(isFailureStatus(TRANSFER_STATUS_CODES.FAILED), true)
})

test('組戻不成立(26)は残高復元対象から除外される（二重支払い防止）', () => {
  // 26 は失敗扱いだが、資金が受取人側に残っているため残高は戻さない
  assert.equal(isFailureStatus(TRANSFER_STATUS_CODES.REFUND_FAILED), true)
  assert.equal(isBalanceRestorableFailureStatus(TRANSFER_STATUS_CODES.REFUND_FAILED), false)
})

test('資金が戻る/送金前終了のステータスは残高復元対象', () => {
  for (const code of [
    TRANSFER_STATUS_CODES.REPAID, // 22 資金返却
    TRANSFER_STATUS_CODES.REFUNDED, // 25 組戻済
    TRANSFER_STATUS_CODES.FAILED, // 40 手続不成立
    TRANSFER_STATUS_CODES.REJECTED, // 3 差戻
    TRANSFER_STATUS_CODES.WITHDRAWN, // 4 取下げ
    TRANSFER_STATUS_CODES.EXPIRED, // 5 期限切れ
    TRANSFER_STATUS_CODES.CANCELLED_APPROVAL, // 8 承認取消
  ]) {
    assert.equal(isBalanceRestorableFailureStatus(code), true)
  }
})

test('成功(20)・組戻手続中(24)・中間状態は残高復元対象ではない', () => {
  assert.equal(isBalanceRestorableFailureStatus(TRANSFER_STATUS_CODES.COMPLETED), false) // 20
  assert.equal(isBalanceRestorableFailureStatus(TRANSFER_STATUS_CODES.REFUND_PROCESSING), false) // 24
  assert.equal(isBalanceRestorableFailureStatus(TRANSFER_STATUS_CODES.PROCESSING), false) // 12
})

test('user facing status text covers all transfer status codes', () => {
  for (const code of Object.values(TRANSFER_STATUS_CODES) as Array<keyof typeof USER_FACING_STATUS_TEXT>) {
    assert.equal(typeof USER_FACING_STATUS_TEXT[code], 'string')
    assert.ok(USER_FACING_STATUS_TEXT[code].length > 0)
  }
})
