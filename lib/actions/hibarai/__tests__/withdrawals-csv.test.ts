import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdminWithdrawalRow } from '../admin-withdrawals'
import { buildWithdrawalsCsv, escapeCsvField, withdrawalStatusLabel } from '../withdrawals-csv'

test('escapeCsvField: 通常値はそのまま、null/undefinedは空文字', () => {
  assert.equal(escapeCsvField('abc'), 'abc')
  assert.equal(escapeCsvField(12000), '12000')
  assert.equal(escapeCsvField(null), '')
  assert.equal(escapeCsvField(undefined), '')
})

test('escapeCsvField: カンマ・改行・ダブルクォートを含む値は引用しエスケープ', () => {
  assert.equal(escapeCsvField('a,b'), '"a,b"')
  assert.equal(escapeCsvField('a\nb'), '"a\nb"')
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""')
})

test('escapeCsvField: 数式起点文字(= + - @)はCSVインジェクション対策で先頭に\'を付与', () => {
  assert.equal(escapeCsvField('=SUM(A1:A9)'), "'=SUM(A1:A9)")
  assert.equal(escapeCsvField('+1'), "'+1")
  assert.equal(escapeCsvField('-cmd'), "'-cmd")
  assert.equal(escapeCsvField('@foo'), "'@foo")
  // 数式起点 + カンマ → 先頭'付与のうえで引用
  assert.equal(escapeCsvField('=a,b'), '"\'=a,b"')
})

test('withdrawalStatusLabel: 既知は日本語ラベル、未知はそのまま', () => {
  assert.equal(withdrawalStatusLabel('COMPLETED'), '完了')
  assert.equal(withdrawalStatusLabel('FAILED'), '失敗')
  assert.equal(withdrawalStatusLabel('UNKNOWN_X'), 'UNKNOWN_X')
})

function row(overrides: Partial<AdminWithdrawalRow> = {}): AdminWithdrawalRow {
  return {
    id: 'wd_1',
    workerId: 1024,
    workerName: '高橋 美咲',
    requestedAmount: 12000,
    feeAmount: 143,
    transferAmount: 11857,
    status: 'completed',
    rawStatus: 'COMPLETED',
    requestedAt: '2026/05/27 10:12:00',
    completedAt: '2026/05/27 10:30:00',
    bankName: '三菱UFJ銀行',
    accountLast4: '1234',
    gmoApplyNo: '1234567890123456',
    settlementMonth: '2026年5月',
    errorMessage: null,
    ...overrides,
  }
}

test('buildWithdrawalsCsv: ヘッダ行＋データ行、列数が一致', () => {
  const csv = buildWithdrawalsCsv([row()])
  const lines = csv.split('\r\n')
  assert.equal(lines.length, 2)
  const header = lines[0].split(',')
  assert.equal(header[0], '申請ID')
  assert.ok(header.includes('GMO申込番号'))
  // データ行の列数はヘッダと一致
  assert.equal(lines[1].split(',').length, header.length)
  assert.match(lines[1], /高橋 美咲/)
  assert.match(lines[1], /完了/)
})

test('buildWithdrawalsCsv: 危険なワーカー名(カンマ/数式)を正しくエスケープ', () => {
  const csv = buildWithdrawalsCsv([row({ workerName: '=cmd,injection' })])
  const dataLine = csv.split('\r\n')[1]
  // 先頭'付与 + カンマ含むため引用される
  assert.match(dataLine, /"'=cmd,injection"/)
})

test('buildWithdrawalsCsv: completedAt/gmoApplyNo が null でも空文字で出力', () => {
  const csv = buildWithdrawalsCsv([row({ completedAt: null, gmoApplyNo: null })])
  const lines = csv.split('\r\n')
  assert.equal(lines[1].split(',').length, lines[0].split(',').length)
})
