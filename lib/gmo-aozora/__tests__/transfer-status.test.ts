import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TRANSFER_STATUS_CODES,
  USER_FACING_STATUS_TEXT,
  isFailureStatus,
  isTerminalStatus,
} from '../transfer-status'

test('completed transfer status is terminal', () => {
  assert.equal(isTerminalStatus(TRANSFER_STATUS_CODES.COMPLETED), true)
})

test('failed transfer status is failure', () => {
  assert.equal(isFailureStatus(TRANSFER_STATUS_CODES.FAILED), true)
})

test('user facing status text covers all transfer status codes', () => {
  for (const code of Object.values(TRANSFER_STATUS_CODES) as Array<keyof typeof USER_FACING_STATUS_TEXT>) {
    assert.equal(typeof USER_FACING_STATUS_TEXT[code], 'string')
    assert.ok(USER_FACING_STATUS_TEXT[code].length > 0)
  }
})
