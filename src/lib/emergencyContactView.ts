/**
 * 施設側「緊急連絡先」モーダルの表示判定（純粋関数・DBアクセスなし）
 *
 * 施設がワーカー詳細で開く緊急連絡先モーダルの表示内容を組み立てる。
 * - 本人への緊急連絡先（本人電話）
 * - 関係者への緊急連絡先（氏名・続柄・電話・住所）
 *
 * イレギュラーな入力（null / 空文字 / 空白のみ / 記号付き電話番号）を
 * 正規化して、表示文言と tel: リンクの href を決定する。
 * 対象コンポーネント: app/admin/workers/[id]/page.tsx の緊急連絡先モーダル
 */

export interface EmergencyContactInput {
  phone?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  emergencyAddress?: string | null;
}

export interface PhoneView {
  /** 表示すべき値があるか（trim後に非空なら true） */
  hasValue: boolean;
  /** 画面表示用の文字列（値がなければ空文字） */
  display: string;
  /** tel: リンクの href（値がなければ null。空白を除去して生成） */
  telHref: string | null;
}

export interface EmergencyContactView {
  /** 本人への緊急連絡先 */
  self: PhoneView;
  /** 関係者への緊急連絡先 */
  related: {
    /** いずれかの項目に値があるか（false なら「登録なし」表示） */
    hasAny: boolean;
    name: string;
    relation: string;
    phone: PhoneView;
    address: string;
  };
}

/** 未入力時の表示文言 */
export const LABEL_SELF_EMPTY = '登録なし';
export const LABEL_RELATED_EMPTY = '登録なし';
export const LABEL_FIELD_EMPTY = '未登録';

/** trim して非空文字列なら返す。null/undefined/空白のみは null */
function normalize(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** tel: リンク用に空白類を除去（ハイフン等の視覚区切りは許容） */
function toTelHref(value: string): string {
  const cleaned = value.replace(/\s+/g, '');
  return `tel:${cleaned}`;
}

/** 電話番号1件分の表示ビューを組み立てる */
export function buildPhoneView(value: string | null | undefined): PhoneView {
  const normalized = normalize(value);
  if (normalized === null) {
    return { hasValue: false, display: '', telHref: null };
  }
  return { hasValue: true, display: normalized, telHref: toTelHref(normalized) };
}

/** フィールド1件の表示文字列（未入力は「未登録」） */
export function fieldOrEmpty(value: string | null | undefined): string {
  return normalize(value) ?? LABEL_FIELD_EMPTY;
}

/** 緊急連絡先モーダル全体のビューを組み立てる */
export function buildEmergencyContactView(
  input: EmergencyContactInput
): EmergencyContactView {
  const self = buildPhoneView(input.phone);
  const relatedPhone = buildPhoneView(input.emergencyPhone);

  const hasAny =
    normalize(input.emergencyName) !== null ||
    normalize(input.emergencyRelation) !== null ||
    normalize(input.emergencyPhone) !== null ||
    normalize(input.emergencyAddress) !== null;

  return {
    self,
    related: {
      hasAny,
      name: fieldOrEmpty(input.emergencyName),
      relation: fieldOrEmpty(input.emergencyRelation),
      phone: relatedPhone,
      address: fieldOrEmpty(input.emergencyAddress),
    },
  };
}
