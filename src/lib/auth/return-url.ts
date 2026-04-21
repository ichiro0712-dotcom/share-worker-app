/**
 * 認証メール等で使用する returnUrl の共通サニタイザ
 *
 * - 相対パス（"/" 始まり、"//" で始まらない）のみ許可
 * - 最大長制限で URL 長制限や中継経路でのリンク破損を防止
 * - null/undefined/不正値は null を返す
 */
const MAX_RETURN_URL_LENGTH = 512;

export function sanitizeReturnUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.length > MAX_RETURN_URL_LENGTH) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}
