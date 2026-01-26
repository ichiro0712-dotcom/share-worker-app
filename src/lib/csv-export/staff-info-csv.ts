/**
 * プールスタッフ情報CSV生成
 * CROSSNAVI仕様（48項目）に準拠
 */

import { generateCsv, formatDateForCsv } from './utils';
import type { StaffWithBankAccount } from '@/app/system-admin/csv-export/staff-info/types';

/**
 * CROSSNAVI仕様の48項目ヘッダー
 */
const STAFF_INFO_HEADERS = [
  '自社スタッフ番号',             // 1. 必須 - User.id
  '事業所',                       // 2. 必須 - 固定「渋谷事業所」
  '登録日',                       // 3. - User.created_at
  'プールスタッフ氏名－姓',       // 4. 必須 - User.nameから分割
  'プールスタッフ氏名－名',       // 5. 必須 - User.nameから分割
  'プールスタッフ氏名カナ－セイ', // 6. - User.last_name_kana
  'プールスタッフ氏名カナ－メイ', // 7. - User.first_name_kana
  '生年月日',                     // 8. 必須 - User.birth_date
  '性別',                         // 9. 必須 - User.gender (0=男, 1=女)
  '電話番号１',                   // 10. 必須 - User.phone_number
  '電話番号１－連絡可否',         // 11. 必須 - 固定「1」
  '電話番号２',                   // 12. 空欄
  '電話番号２－連絡可否',         // 13. 空欄
  '連絡用E-Mail１',               // 14. 必須 - User.email
  '連絡用E-Mail１－連絡可否',     // 15. 固定「1」
  '連絡用E-Mail２',               // 16. 空欄
  '連絡用E-Mail２－連絡可否',     // 17. 空欄
  '口座情報－銀行コード',         // 18. 必須 - BankAccount.bankCode
  '口座情報－銀行支店コード',     // 19. 必須 - BankAccount.branchCode
  '口座情報－口座種別',           // 20. 必須 - BankAccount.accountType (0=普通, 1=当座)
  '口座情報－口座番号',           // 21. 必須 - BankAccount.accountNumber
  '口座情報－口座名義',           // 22. 必須 - BankAccount.accountHolderName
  '配偶者有無',                   // 23. 必須 - 固定「2」（不明）
  '扶養対象者人数',               // 24. 必須 - 固定「0」
  '現住所－郵便番号',             // 25. 必須 - User.postal_code
  '現住所－都道府県',             // 26. 必須 - User.prefecture
  '現住所－市区町村',             // 27. 必須 - User.city
  '現住所－住所',                 // 28. 必須 - User.address_line
  '現住所－アパート・マンション', // 29. 必須 - User.building
  '現住所カナ',                   // 30. 空欄
  '最寄り駅－線',                 // 31. 空欄
  '最寄り駅－駅',                 // 32. 空欄
  '連絡先住所－郵便番号',         // 33. 必須 - 現住所を引用
  '連絡先住所－都道府県',         // 34. 必須 - 現住所を引用
  '連絡先住所－市区町村',         // 35. 必須 - 現住所を引用
  '連絡先住所－住所',             // 36. 必須 - 現住所を引用
  '連絡先住所－アパート・マンション', // 37. 必須 - 現住所を引用
  '連絡先住所カナ',               // 38. 空欄
  '連絡先住所－TEL',              // 39. 空欄
  '連絡先住所－FAX',              // 40. 空欄
  '連絡先住所－内線',             // 41. 空欄
  '住民票住所－郵便番号',         // 42. 必須 - 現住所を引用
  '住民票住所－都道府県',         // 43. 必須 - 現住所を引用
  '住民票住所－市区町村',         // 44. 必須 - 現住所を引用
  '住民票住所－住所',             // 45. 必須 - 現住所を引用
  '住民票住所－アパート・マンション', // 46. 必須 - 現住所を引用
  '住民票住所カナ',               // 47. 空欄
  '住民票住所カナ２',             // 48. 空欄
];

/**
 * 氏名を姓と名に分割
 * @param name フルネーム
 * @returns [姓, 名]
 */
function splitName(name: string): [string, string] {
  if (!name) return ['', ''];
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return [parts[0], parts.slice(1).join(' ')];
  }
  return [name, ''];
}

/**
 * 性別をCROSSNAVIコードに変換
 * @param gender 性別文字列
 * @returns 0=男, 1=女, 空欄=不明
 */
function convertGender(gender: string | null): string {
  if (!gender) return '';
  if (gender === 'male' || gender === '男性') return '0';
  if (gender === 'female' || gender === '女性') return '1';
  return '';
}

/**
 * 口座種別をCROSSNAVIコードに変換
 * @param accountType 口座種別
 * @returns 0=普通, 1=当座
 */
function convertAccountType(accountType: string | null): string {
  if (!accountType) return '0'; // デフォルト普通預金
  if (accountType === 'CURRENT') return '1';
  return '0'; // ORDINARY または不明
}

/**
 * プールスタッフ情報CSV生成
 * @param staffList StaffWithBankAccount配列
 * @returns CSV文字列
 */
export function generateStaffInfoCsv(staffList: StaffWithBankAccount[]): string {
  const rows = staffList.map(staff => {
    const [lastName, firstName] = splitName(staff.name);
    const bankAccount = staff.bankAccount;

    return [
      String(staff.id), // 1. 自社スタッフ番号
      '渋谷事業所', // 2. 事業所（固定）
      formatDateForCsv(staff.created_at), // 3. 登録日
      lastName, // 4. 姓
      firstName, // 5. 名
      staff.last_name_kana || '', // 6. セイ
      staff.first_name_kana || '', // 7. メイ
      formatDateForCsv(staff.birth_date), // 8. 生年月日
      convertGender(staff.gender), // 9. 性別
      staff.phone_number || '', // 10. 電話番号１
      '1', // 11. 電話番号１－連絡可否（固定）
      '', // 12. 電話番号２
      '', // 13. 電話番号２－連絡可否
      staff.email || '', // 14. 連絡用E-Mail１
      '1', // 15. 連絡用E-Mail１－連絡可否（固定）
      '', // 16. 連絡用E-Mail２
      '', // 17. 連絡用E-Mail２－連絡可否
      bankAccount?.bankCode || '', // 18. 銀行コード
      bankAccount?.branchCode || '', // 19. 銀行支店コード
      bankAccount ? convertAccountType(bankAccount.accountType) : '', // 20. 口座種別
      bankAccount?.accountNumber || '', // 21. 口座番号
      bankAccount?.accountHolderName || '', // 22. 口座名義
      '2', // 23. 配偶者有無（固定: 不明）
      '0', // 24. 扶養対象者人数（固定: 0）
      staff.postal_code || '', // 25. 現住所－郵便番号
      staff.prefecture || '', // 26. 現住所－都道府県
      staff.city || '', // 27. 現住所－市区町村
      staff.address_line || '', // 28. 現住所－住所
      staff.building || '', // 29. 現住所－アパート・マンション
      '', // 30. 現住所カナ
      '', // 31. 最寄り駅－線
      '', // 32. 最寄り駅－駅
      staff.postal_code || '', // 33. 連絡先住所－郵便番号（現住所を引用）
      staff.prefecture || '', // 34. 連絡先住所－都道府県（現住所を引用）
      staff.city || '', // 35. 連絡先住所－市区町村（現住所を引用）
      staff.address_line || '', // 36. 連絡先住所－住所（現住所を引用）
      staff.building || '', // 37. 連絡先住所－アパート・マンション（現住所を引用）
      '', // 38. 連絡先住所カナ
      '', // 39. 連絡先住所－TEL
      '', // 40. 連絡先住所－FAX
      '', // 41. 連絡先住所－内線
      staff.postal_code || '', // 42. 住民票住所－郵便番号（現住所を引用）
      staff.prefecture || '', // 43. 住民票住所－都道府県（現住所を引用）
      staff.city || '', // 44. 住民票住所－市区町村（現住所を引用）
      staff.address_line || '', // 45. 住民票住所－住所（現住所を引用）
      staff.building || '', // 46. 住民票住所－アパート・マンション（現住所を引用）
      '', // 47. 住民票住所カナ
      '', // 48. 住民票住所カナ２
    ];
  });

  return generateCsv(STAFF_INFO_HEADERS, rows);
}

/**
 * ヘッダー配列を取得（テスト・検証用）
 */
export function getStaffInfoHeaders(): string[] {
  return [...STAFF_INFO_HEADERS];
}

/**
 * ヘッダー数を取得
 */
export function getStaffInfoHeaderCount(): number {
  return STAFF_INFO_HEADERS.length;
}
