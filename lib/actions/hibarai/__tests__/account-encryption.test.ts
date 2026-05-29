import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'

// 32バイト鍵をbase64で用意（module読込前に設定）
process.env.HIBARAI_ACCOUNT_ENC_KEY = crypto.randomBytes(32).toString('base64')

let encryptAccountNumber: typeof import('../account-encryption').encryptAccountNumber
let decryptAccountNumber: typeof import('../account-encryption').decryptAccountNumber
let isEncrypted: typeof import('../account-encryption').isEncrypted
let accountLast4: typeof import('../account-encryption').accountLast4
let AccountEncryptionError: typeof import('../account-encryption').AccountEncryptionError
let readStoredAccountNumber: typeof import('../account-encryption').readStoredAccountNumber
let toStoredAccountNumber: typeof import('../account-encryption').toStoredAccountNumber

test.before(async () => {
  const mod = await import('../account-encryption')
  encryptAccountNumber = mod.encryptAccountNumber
  decryptAccountNumber = mod.decryptAccountNumber
  isEncrypted = mod.isEncrypted
  accountLast4 = mod.accountLast4
  AccountEncryptionError = mod.AccountEncryptionError
  readStoredAccountNumber = mod.readStoredAccountNumber
  toStoredAccountNumber = mod.toStoredAccountNumber
})

test('暗号化→復号で元に戻る（可逆・値が変わらない）', () => {
  const original = '1234567'
  const enc = encryptAccountNumber(original)
  assert.notEqual(enc, original)
  assert.ok(enc.startsWith('v1:'))
  assert.equal(decryptAccountNumber(enc), original)
})

test('同じ平文でも毎回異なる暗号文（IVランダム）だが復号は一致', () => {
  const a = encryptAccountNumber('0012345')
  const b = encryptAccountNumber('0012345')
  assert.notEqual(a, b)
  assert.equal(decryptAccountNumber(a), '0012345')
  assert.equal(decryptAccountNumber(b), '0012345')
})

test('isEncrypted: v1接頭辞を判定', () => {
  assert.equal(isEncrypted(encryptAccountNumber('1111111')), true)
  assert.equal(isEncrypted('1234567'), false)
  assert.equal(isEncrypted(null), false)
  assert.equal(isEncrypted(undefined), false)
})

test('改ざんされた暗号文は復号で例外（GCM認証）', () => {
  const enc = encryptAccountNumber('7654321')
  const parts = enc.split(':')
  // 暗号文部を1文字壊す
  const tampered = [parts[0], parts[1], parts[2], Buffer.from('deadbeef').toString('base64')].join(':')
  assert.throws(() => decryptAccountNumber(tampered))
})

test('不正な形式は AccountEncryptionError', () => {
  assert.throws(() => decryptAccountNumber('not-encrypted'), AccountEncryptionError)
  assert.throws(() => decryptAccountNumber('v2:a:b:c'), AccountEncryptionError)
})

test('accountLast4: 下4桁', () => {
  assert.equal(accountLast4('1234567'), '4567')
  assert.equal(accountLast4('12'), '12')
})

test('readStoredAccountNumber: 暗号化済みは復号、平文はそのまま、空はnull', () => {
  const enc = encryptAccountNumber('1234567')
  assert.equal(readStoredAccountNumber(enc), '1234567') // 暗号文→復号
  assert.equal(readStoredAccountNumber('1234567'), '1234567') // 平文(移行前)はそのまま
  assert.equal(readStoredAccountNumber(null), null)
  assert.equal(readStoredAccountNumber(''), null)
})

test('toStoredAccountNumber: 平文→暗号化、二重暗号化しない、空はnull', () => {
  const stored = toStoredAccountNumber('7654321')
  assert.ok(isEncrypted(stored!))
  assert.equal(readStoredAccountNumber(stored), '7654321')
  // 既に暗号化済みは二重暗号化しない（復号して同じ値）
  assert.equal(toStoredAccountNumber(stored), stored)
  assert.equal(toStoredAccountNumber(null), null)
  assert.equal(toStoredAccountNumber(''), null)
})
