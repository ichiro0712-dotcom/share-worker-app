import { createHmac, timingSafeEqual } from 'crypto'

/**
 * GMO WebhookのHMAC-SHA256署名をconstant-time比較で検証する。
 */
export function verifyWebhookSignature(
  bodyRaw: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false

  const normalizedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader
  const expected = createHmac('sha256', secret).update(bodyRaw).digest('base64')
  const receivedBuffer = Buffer.from(normalizedSignature)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) return false

  try {
    return timingSafeEqual(receivedBuffer, expectedBuffer)
  } catch {
    return false
  }
}
