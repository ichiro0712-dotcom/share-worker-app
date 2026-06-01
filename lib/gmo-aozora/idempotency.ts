import { randomUUID } from 'crypto'

const MAX_IDEMPOTENCY_KEY_LENGTH = 128

/**
 * GMOのIdempotency-Key制約に収まる冪等キーを生成する。
 */
export function generateIdempotencyKey(prefix = 'WID'): string {
  const safePrefix = prefix.trim().replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 32) || 'WID'
  const key = `hibarai-${safePrefix}-${randomUUID()}`
  return key.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH)
}

/**
 * GMOに送るIdempotency-Keyとして最低限有効な形式かを検証する。
 */
export function isValidIdempotencyKey(key: string): boolean {
  return /^[\x21-\x7E]{1,128}$/.test(key)
}
