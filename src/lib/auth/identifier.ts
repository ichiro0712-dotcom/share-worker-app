export type LoginIdentifier =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string }
  | { type: 'invalid' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(input: string): string {
  return input
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/＠/g, '@')
    .replace(/\u3000/g, ' ');
}

/**
 * 電話番号を「数字のみ」の正規化形式に変換する。
 * 全角数字・ハイフン・スペース・括弧などをすべて除去。
 */
export function normalizePhoneDigits(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');
}

/**
 * 正規化済み電話番号を Postgres advisory lock キー用の数値文字列に変換する。
 * BigInt を直接 $queryRaw に渡すと driver 側でシリアライズ問題が起きるため、
 * 文字列として渡して SQL 側で `::bigint` キャストする。
 */
export function phoneLockKey(normalized: string): string {
  return normalized.replace(/^0+/, '') || '0';
}

export function parseLoginIdentifier(raw: string | undefined | null): LoginIdentifier {
  if (!raw) return { type: 'invalid' };

  const normalized = normalize(raw);
  if (!normalized) return { type: 'invalid' };

  if (EMAIL_RE.test(normalized)) {
    return { type: 'email', value: normalized.toLowerCase() };
  }

  // 電話番号候補: 数字・ハイフン・スペース・括弧・プラスのみを許可
  if (!/^[0-9\s\-+()]+$/.test(normalized)) {
    return { type: 'invalid' };
  }
  const digitsOnly = normalized.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return { type: 'phone', value: digitsOnly };
  }

  return { type: 'invalid' };
}
