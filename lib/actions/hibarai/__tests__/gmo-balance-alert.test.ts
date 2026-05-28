import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGmoAlertEmail,
  decideGmoAlert,
  gmoAlertLabel,
  jstDateKey,
  parseAlertState,
} from '../gmo-balance-alert'
import { DEFAULT_GMO_THRESHOLDS } from '../settings'

test('decideGmoAlert: ok は通知しない（送信履歴は維持＝振動で連発しない）', () => {
  const state = { sentByLevel: { caution: '2026-05-29' } }
  assert.deepEqual(decideGmoAlert('ok', state, '2026-05-29'), { notify: false, nextState: state })
  assert.deepEqual(decideGmoAlert('ok', null, '2026-05-29'), { notify: false, nextState: { sentByLevel: {} } })
})

test('decideGmoAlert: 初回（状態なし）は通知し、レベル別に当日を記録', () => {
  assert.deepEqual(decideGmoAlert('caution', null, '2026-05-29'), {
    notify: true,
    nextState: { sentByLevel: { caution: '2026-05-29' } },
  })
})

test('decideGmoAlert: 同じレベルを当日に再送しない（クールダウン）', () => {
  assert.deepEqual(decideGmoAlert('warning', { sentByLevel: { warning: '2026-05-29' } }, '2026-05-29'), {
    notify: false,
    nextState: { sentByLevel: { warning: '2026-05-29' } },
  })
})

test('decideGmoAlert: 同じレベルでも翌日は再通知（日次リマインド）', () => {
  assert.deepEqual(decideGmoAlert('warning', { sentByLevel: { warning: '2026-05-28' } }, '2026-05-29'), {
    notify: true,
    nextState: { sentByLevel: { warning: '2026-05-29' } },
  })
})

test('decideGmoAlert: 悪化(caution→critical)は当日でも通知（criticalが当日未送信）', () => {
  assert.deepEqual(decideGmoAlert('critical', { sentByLevel: { caution: '2026-05-29' } }, '2026-05-29'), {
    notify: true,
    nextState: { sentByLevel: { caution: '2026-05-29', critical: '2026-05-29' } },
  })
})

test('decideGmoAlert: critical→warning→critical 同日 は critical を二重送信しない', () => {
  // criticalを送信済み
  const afterCritical = decideGmoAlert('critical', null, '2026-05-29')
  assert.equal(afterCritical.notify, true)
  // warningへ改善 → warningは当日未送信なので通知
  const afterWarning = decideGmoAlert('warning', afterCritical.nextState, '2026-05-29')
  assert.equal(afterWarning.notify, true)
  // 再びcritical → 当日送信済みなので通知しない（連発防止）
  const reCritical = decideGmoAlert('critical', afterWarning.nextState, '2026-05-29')
  assert.equal(reCritical.notify, false)
})

test('decideGmoAlert: caution→ok→caution 同日 は再通知しない（閾値付近の振動）', () => {
  const afterCaution = decideGmoAlert('caution', null, '2026-05-29')
  assert.equal(afterCaution.notify, true)
  const afterOk = decideGmoAlert('ok', afterCaution.nextState, '2026-05-29')
  assert.equal(afterOk.notify, false)
  const reCaution = decideGmoAlert('caution', afterOk.nextState, '2026-05-29')
  assert.equal(reCaution.notify, false)
})

test('parseAlertState: 不正値は空状態、正常値はレベル別に復元', () => {
  assert.deepEqual(parseAlertState(null), { sentByLevel: {} })
  assert.deepEqual(parseAlertState('not json'), { sentByLevel: {} })
  assert.deepEqual(parseAlertState('{"sentByLevel":{"warning":"2026-05-29","bogus":"x"}}'), {
    sentByLevel: { warning: '2026-05-29' },
  })
})

test('jstDateKey: UTCインスタンスをJSTの YYYY-MM-DD に変換する', () => {
  assert.equal(jstDateKey(new Date('2026-05-28T16:00:00Z')), '2026-05-29') // JST 05-29 01:00
  assert.equal(jstDateKey(new Date('2026-05-28T14:00:00Z')), '2026-05-28') // JST 05-28 23:00
})

test('gmoAlertLabel: レベルごとの日本語ラベル', () => {
  assert.equal(gmoAlertLabel('caution'), '注意')
  assert.equal(gmoAlertLabel('warning'), '警告')
  assert.equal(gmoAlertLabel('critical'), '危険')
})

test('buildGmoAlertEmail: 件名と本文にレベル・残高・閾値を含む', () => {
  const { subject, html } = buildGmoAlertEmail({
    level: 'critical',
    balance: 150000,
    thresholds: DEFAULT_GMO_THRESHOLDS,
    dashboardUrl: 'https://tastas.work/system-admin/hibarai',
  })
  assert.match(subject, /危険/)
  assert.match(subject, /GMO/)
  assert.match(html, /150,000/)
  assert.match(html, /200,000/)
  assert.match(html, /tastas\.work\/system-admin\/hibarai/)
})
