/**
 * 文字列変換ユーティリティ
 *
 * 全角・半角変換など
 */

/**
 * 半角英数字を全角に変換
 * a-z → ａ-ｚ
 * A-Z → Ａ-Ｚ
 * 0-9 → ０-９
 */
export function toFullWidth(str: string): string {
  return str.replace(/[a-zA-Z0-9]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0xFEE0);
  });
}

/**
 * 全角英数字を半角に変換
 * ａ-ｚ → a-z
 * Ａ-Ｚ → A-Z
 * ０-９ → 0-9
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[ａ-ｚＡ-Ｚ０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 文字列を正規化（検索用）
 * - 全角英数字を半角に変換
 * - 小文字に変換
 */
export function normalizeForSearch(str: string): string {
  return toHalfWidth(str).toLowerCase();
}

/**
 * カタカナをひらがなに変換
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

/**
 * ひらがなをカタカナに変換
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

/**
 * 小文字カタカナを大文字カタカナに変換（銀行口座名義用）
 * ァ→ア, ィ→イ, ゥ→ウ, ェ→エ, ォ→オ, ッ→ツ, ャ→ヤ, ュ→ユ, ョ→ヨ, ヮ→ワ
 */
export function smallKatakanaToLarge(str: string): string {
  const smallToLargeMap: Record<string, string> = {
    'ァ': 'ア',
    'ィ': 'イ',
    'ゥ': 'ウ',
    'ェ': 'エ',
    'ォ': 'オ',
    'ッ': 'ツ',
    'ャ': 'ヤ',
    'ュ': 'ユ',
    'ョ': 'ヨ',
    'ヮ': 'ワ',
  };

  return str.replace(/[ァィゥェォッャュョヮ]/g, (char) => smallToLargeMap[char] || char);
}

/**
 * 銀行口座名義を生成（姓カナ + 全角スペース + 名カナ）
 * - 小文字カタカナは大文字に変換
 * - 全角スペースで結合
 */
export function generateBankAccountName(lastNameKana: string, firstNameKana: string): string {
  if (!lastNameKana || !firstNameKana) {
    return '';
  }

  const lastName = smallKatakanaToLarge(lastNameKana.trim());
  const firstName = smallKatakanaToLarge(firstNameKana.trim());

  // 全角スペースで結合
  return `${lastName}　${firstName}`;
}
