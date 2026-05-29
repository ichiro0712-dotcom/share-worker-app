// 口座番号のアプリ層暗号化（AES-256-GCM）。
// GMO振込時に復号して使うため対称・可逆。鍵は環境変数 HIBARAI_ACCOUNT_ENC_KEY（base64の32バイト）。
// 形式: "v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"（バージョン付きでローテーション可能）。
import crypto from 'node:crypto'

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

export class AccountEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountEncryptionError'
  }
}

/** 環境変数から鍵(32バイト)を読む。未設定/不正なら例外。 */
function getKey(): Buffer {
  const raw = process.env.HIBARAI_ACCOUNT_ENC_KEY
  if (!raw) throw new AccountEncryptionError('HIBARAI_ACCOUNT_ENC_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new AccountEncryptionError('HIBARAI_ACCOUNT_ENC_KEY must be 32 bytes (base64)')
  return key
}

/** 暗号化キーが設定されているか（バックフィル/同期の事前判定用）。 */
export function isAccountEncryptionConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

/** 暗号化済み文字列か（v1:接頭辞）を判定（純粋）。 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`)
}

/** 口座番号を暗号化する。"v1:iv:tag:ct"。 */
export function encryptAccountNumber(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/** 暗号化文字列を復号する。改ざん/鍵不一致はGCM検証で例外。 */
export function decryptAccountNumber(encoded: string): string {
  const key = getKey()
  const parts = encoded.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new AccountEncryptionError('Invalid encrypted account number format')
  }
  const [, ivB64, tagB64, ctB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** 表示用の下4桁。 */
export function accountLast4(accountNumber: string): string {
  return accountNumber.slice(-4)
}

/**
 * 保存値→表示/利用用の口座番号。暗号化済みなら復号、平文(バックフィル前)ならそのまま返す。
 * 鍵未設定や復号失敗時は null（画面クラッシュを避ける。鍵は本番で必須）。
 * 全読み取り箇所はこれを通すことで、移行中の平文/暗号文の混在に耐える。
 */
export function readStoredAccountNumber(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null
  if (!isEncrypted(stored)) return stored
  try {
    return decryptAccountNumber(stored)
  } catch (e) {
    // 鍵未設定/ローテーション漏れ等。silent nullだと「データ消失」に見えるためログを残す。
    console.error('[account-encryption] decrypt failed (key missing or rotated?):', e)
    return null
  }
}

/**
 * 平文→保存用。鍵設定済みなら暗号化、未設定なら平文のまま（段階移行で保存を壊さない）。
 * 既に暗号化済みの値は二重暗号化しない。
 */
export function toStoredAccountNumber(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null
  if (isEncrypted(plaintext)) return plaintext
  if (!isAccountEncryptionConfigured()) return plaintext
  return encryptAccountNumber(plaintext)
}
