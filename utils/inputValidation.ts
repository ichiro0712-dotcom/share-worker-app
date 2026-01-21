/**
 * 入力フィールドのバリデーション・フォーマット関数
 * Task #13: 入力フィールドバリデーション強化
 */

// カタカナのみを許可（ひらがな、英数字、記号を除外）
export function isKatakanaOnly(value: string): boolean {
  // 全角カタカナ、長音記号、中点のみ許可
  return /^[ァ-ヶー・]+$/.test(value);
}

// ひらがなをカタカナに変換
export function hiraganaToKatakana(value: string): string {
  return value.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
}

// カタカナ入力用のハンドラー（ひらがな自動変換のみ、他の文字は残す）
// バリデーションは送信時にisKatakanaOnlyで行う
export function formatKatakana(value: string): string {
  // ひらがなをカタカナに変換するだけ（他の文字は残す）
  return hiraganaToKatakana(value);
}

// カタカナ入力用（スペース許容版: 口座名義などに使用）
// バリデーションは送信時にisKatakanaWithSpaceOnlyで行う
export function formatKatakanaWithSpace(value: string): string {
  // ひらがなをカタカナに変換するだけ（他の文字は残す）
  return hiraganaToKatakana(value);
}

// カタカナとスペースのみかどうかを判定（口座名義用）
export function isKatakanaWithSpaceOnly(value: string): boolean {
  // 全角カタカナ、長音記号、中点、全角スペース、半角スペースのみ許可
  return /^[ァ-ヶー・　 ]+$/.test(value);
}

// 全角数字を半角に変換
export function toHalfWidthNumbers(value: string): string {
  return value.replace(/[０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
}

// 電話番号フォーマット（ハイフン自動挿入）
// 日本の電話番号パターンに対応:
// - 携帯電話 (070/080/090/050): 3桁-4桁-4桁 (例: 090-1234-5678)
// - 東京/大阪 (03/06): 2桁-4桁-4桁 (例: 03-1234-5678)
// - 3桁市外局番: 3桁-3桁-4桁 (例: 045-123-4567)
// - フリーダイヤル (0120/0800): 4桁-3桁-3桁 (例: 0120-123-456)
export function formatPhoneNumber(value: string): string {
  // 全角数字を半角に変換してから数字以外を除去
  const digitsOnly = toHalfWidthNumbers(value).replace(/\D/g, '');

  // 最大11桁に制限
  const limited = digitsOnly.slice(0, 11);

  if (limited.length === 0) return '';

  // 携帯電話パターン (070/080/090/050): 3桁-4桁-4桁
  if (/^0[5789]0/.test(limited)) {
    if (limited.length <= 3) return limited;
    if (limited.length <= 7) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
  }

  // フリーダイヤル (0120/0800): 4桁-3桁-3桁
  if (/^0120|^0800/.test(limited)) {
    if (limited.length <= 4) return limited;
    if (limited.length <= 7) return `${limited.slice(0, 4)}-${limited.slice(4)}`;
    return `${limited.slice(0, 4)}-${limited.slice(4, 7)}-${limited.slice(7)}`;
  }

  // 2桁市外局番 (03/04/06): 2桁-4桁-4桁
  if (/^0[346]/.test(limited) && limited.length >= 2) {
    if (limited.length <= 2) return limited;
    if (limited.length <= 6) return `${limited.slice(0, 2)}-${limited.slice(2)}`;
    return `${limited.slice(0, 2)}-${limited.slice(2, 6)}-${limited.slice(6)}`;
  }

  // その他の固定電話（3桁市外局番として扱う）: 3桁-3桁-4桁
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
}

// 電話番号バリデーション（10桁または11桁）
export function isValidPhoneNumber(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  return /^[0-9]{10,11}$/.test(digitsOnly);
}

// メールアドレスバリデーション
export function isValidEmail(value: string): boolean {
  // RFC 5322準拠のシンプルな正規表現
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// 郵便番号フォーマット（ハイフン自動挿入）
export function formatPostalCode(value: string): string {
  // 数字以外を除去
  const digitsOnly = value.replace(/\D/g, '');

  // 最大7桁に制限
  const limited = digitsOnly.slice(0, 7);

  // ハイフン自動挿入（3桁-4桁）
  if (limited.length <= 3) {
    return limited;
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  }
}

// 郵便番号バリデーション（7桁）
export function isValidPostalCode(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  return /^[0-9]{7}$/.test(digitsOnly);
}

// 法人番号バリデーション（13桁）
export function isValidCorporateNumber(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  return /^[0-9]{13}$/.test(digitsOnly);
}

// 法人番号フォーマット（数字のみに制限）
export function formatCorporateNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}
