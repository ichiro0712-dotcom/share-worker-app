import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBankAccountSyncPayload, didBankIdentityChange } from '../bank-account-bridge'

const base = {
  bank_code: '0001',
  bank_name: 'みずほ銀行',
  branch_code: '001',
  branch_name: '本店',
  account_name: 'タカハシ ミサキ',
  account_number: '1234567', // 平文（テストでは平文でOK／実環境では暗号化された値も readStoredAccountNumber が復号）
}

test('buildBankAccountSyncPayload: 全必須揃えばペイロード生成', () => {
  const p = buildBankAccountSyncPayload(base)
  assert.ok(p)
  assert.equal(p.bankCode, '0001')
  assert.equal(p.branchCode, '001')
  assert.equal(p.accountNumber, '1234567') // 平文（既存BankAccount.accountNumberは平文)
  assert.equal(p.accountHolderName, 'タカハシ ミサキ')
  assert.equal(p.accountHolderNameKana, 'タカハシ ミサキ')
  assert.equal(p.accountType, 'ORDINARY')
})

test('buildBankAccountSyncPayload: 必須欠落はnull（同期しない）', () => {
  assert.equal(buildBankAccountSyncPayload({ ...base, bank_code: null }), null)
  assert.equal(buildBankAccountSyncPayload({ ...base, branch_code: null }), null)
  assert.equal(buildBankAccountSyncPayload({ ...base, account_number: null }), null)
  assert.equal(buildBankAccountSyncPayload({ ...base, account_name: null }), null)
  assert.equal(buildBankAccountSyncPayload({ ...base, account_number: '' }), null)
})

test('buildBankAccountSyncPayload: 全銀に収まらない口座番号(8桁/非数字)はnull（VarChar(7)溢れ＝PROFILE_UPDATE_FAILED防止）', () => {
  // ゆうちょ8桁番号が口座番号欄にそのまま入った等。BankAccount.accountNumber は VarChar(7)。
  // 同期させると "value too long" でプロフィール保存tx全体がrollbackするため、同期しない（null）。
  assert.equal(buildBankAccountSyncPayload({ ...base, account_number: '12345671' }), null) // 8桁
  assert.equal(buildBankAccountSyncPayload({ ...base, account_number: '123456789' }), null) // 9桁
  assert.equal(buildBankAccountSyncPayload({ ...base, account_number: '12-34567' }), null) // 非数字混入
  // 7桁ちょうどはOK
  assert.ok(buildBankAccountSyncPayload({ ...base, account_number: '1234567' }))
})

test('buildBankAccountSyncPayload: 任意項目(bank_name/branch_name)欠落でも生成（空文字）', () => {
  const p = buildBankAccountSyncPayload({ ...base, bank_name: null, branch_name: null })
  assert.ok(p)
  assert.equal(p.bankName, '')
  assert.equal(p.branchName, '')
})

test('didBankIdentityChange: prev=null は変化扱い', () => {
  const next = buildBankAccountSyncPayload(base)!
  assert.equal(didBankIdentityChange(null, next), true)
})

test('didBankIdentityChange: 全フィールド同一は変化なし', () => {
  const p = buildBankAccountSyncPayload(base)!
  const prev = {
    bankCode: p.bankCode,
    branchCode: p.branchCode,
    accountNumber: p.accountNumber,
    accountHolderName: p.accountHolderName,
    accountHolderNameKana: p.accountHolderNameKana,
    accountType: p.accountType,
  }
  assert.equal(didBankIdentityChange(prev, p), false)
})

test('didBankIdentityChange: 識別フィールド差分は変化扱い', () => {
  const next = buildBankAccountSyncPayload(base)!
  const same = {
    bankCode: next.bankCode,
    branchCode: next.branchCode,
    accountNumber: next.accountNumber,
    accountHolderName: next.accountHolderName,
    accountHolderNameKana: next.accountHolderNameKana,
    accountType: next.accountType,
  }
  assert.equal(didBankIdentityChange({ ...same, bankCode: '9999' }, next), true)
  assert.equal(didBankIdentityChange({ ...same, branchCode: '999' }, next), true)
  assert.equal(didBankIdentityChange({ ...same, accountNumber: '9999999' }, next), true)
  assert.equal(didBankIdentityChange({ ...same, accountHolderName: 'ヤマダ タロウ' }, next), true)
  assert.equal(didBankIdentityChange({ ...same, accountHolderNameKana: 'ヤマダ タロウ' }, next), true)
  assert.equal(didBankIdentityChange({ ...same, accountType: 'CURRENT' as const }, next), true)
})

test('didBankIdentityChange: 名称(bank_name/branch_name)だけ変わっても識別変化ではない', () => {
  // bankName/branchNameは識別フィールドではない(コードで判別)。先方銀行が名称変更した等で
  // lastChangedAtを誤って更新しないため、識別フィールドのみで判定する。
  // (next/prevにbankNameは含めていない=識別外として扱う設計)
  const next = buildBankAccountSyncPayload(base)!
  const prev = {
    bankCode: next.bankCode,
    branchCode: next.branchCode,
    accountNumber: next.accountNumber,
    accountHolderName: next.accountHolderName,
    accountHolderNameKana: next.accountHolderNameKana,
    accountType: next.accountType,
  }
  assert.equal(didBankIdentityChange(prev, next), false)
})
