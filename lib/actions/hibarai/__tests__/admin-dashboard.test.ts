import assert from 'node:assert/strict'
import test from 'node:test'

import { mapAuditResult, mapAuditType } from '../admin-dashboard'

test('監査result→表示マップ', () => {
  assert.equal(mapAuditResult('SUCCESS'), '成功')
  assert.equal(mapAuditResult('ERROR'), '失敗')
  assert.equal(mapAuditResult('WARNING'), '警告')
  assert.equal(mapAuditResult('UNKNOWN'), '承認待ち')
})

test('action→種別マップ', () => {
  assert.equal(mapAuditType('EMERGENCY_STOP_TRIGGERED'), 'emergency')
  assert.equal(mapAuditType('EMERGENCY_STOP_RELEASED'), 'emergency')
  assert.equal(mapAuditType('POLICY_UPDATED'), 'policy')
  assert.equal(mapAuditType('HIBARAI_SETTINGS_UPDATED'), 'policy')
  assert.equal(mapAuditType('WITHDRAWAL_REQUESTED'), 'withdrawal')
  assert.equal(mapAuditType('WITHDRAWAL_COMPLETED'), 'withdrawal')
  assert.equal(mapAuditType('ATTENDANCE_CONFIRMED'), 'withdrawal')
})
