/**
 * 入力フィールドのバリデーション・フォーマット関数
 * Task #13: 入力フィールドバリデーション強化
 */
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

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

// 電話番号フォーマット（数字のみに制限）
// ハイフンは自動挿入せず、数字のみで保存
export function formatPhoneNumber(value: string): string {
  // 全角数字を半角に変換してから数字以外を除去
  const digitsOnly = toHalfWidthNumbers(value).replace(/\D/g, '');

  // 最大11桁に制限
  return digitsOnly.slice(0, 11);
}

// 電話番号バリデーション（google-libphonenumberで日本の番号として有効か判定）
export function isValidPhoneNumber(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  // 基本的な桁数チェック（10-11桁）
  if (!/^[0-9]{10,11}$/.test(digitsOnly)) return false;

  try {
    const phoneUtil = PhoneNumberUtil.getInstance();
    const number = phoneUtil.parse(digitsOnly, 'JP');
    return phoneUtil.isValidNumberForRegion(number, 'JP');
  } catch {
    return false;
  }
}

// 電話番号をフォーマット済み文字列で返す（表示用）
export function formatPhoneNumberDisplay(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  try {
    const phoneUtil = PhoneNumberUtil.getInstance();
    const number = phoneUtil.parse(digitsOnly, 'JP');
    if (phoneUtil.isValidNumberForRegion(number, 'JP')) {
      return phoneUtil.format(number, PhoneNumberFormat.NATIONAL);
    }
  } catch {
    // パース失敗時はそのまま返す
  }
  return digitsOnly;
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
