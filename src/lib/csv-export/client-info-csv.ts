/**
 * 取引先情報CSV生成
 * CROSSNAVI仕様（28項目）に準拠
 */

import { Facility } from '@prisma/client';
import { generateCsv } from './utils';

/**
 * CROSSNAVI仕様の28項目ヘッダー
 */
const CLIENT_INFO_HEADERS = [
  '取引先番号',
  '法人番号',
  '法人名称',
  '法人名称カナ',
  '自社名称',
  '自社名称カナ',
  '郵便番号',
  '都道府県',
  '市区町村',
  '住所',
  '代表者名',
  '代表電話番号',
  '代表FAX番号',
  'URL',
  '銀行コード',
  '支店コード',
  '口座番号',
  '口座名義人',
  '振込依頼人番号',
  '受動喫煙防止措置',
  '事業所番号',
  '事業所名称',
  '郵便番号',
  '都道府県／市区町村',
  '住所',
  '電話番号',
  '担当者氏',
  '担当者名',
];

/**
 * 取引先情報CSV生成
 * @param facilities Facility配列
 * @returns CSV文字列
 */
export function generateClientInfoCsv(facilities: Facility[]): string {
  const rows = facilities.map(f => {
    // 代表者名（姓 + 名）
    const representativeName = [
      f.representative_last_name,
      f.representative_first_name,
    ].filter(Boolean).join(' ');

    // 都道府県／市区町村（事業所住所）
    const prefectureCity = [f.prefecture, f.city].filter(Boolean).join('／');

    return [
      '', // 1. 取引先番号（未対応）
      f.corporation_number || '', // 2. 法人番号
      f.corporation_name || '', // 3. 法人名称
      '', // 4. 法人名称カナ（未対応）
      f.corporation_name || '', // 5. 自社名称 = 法人名称
      '', // 6. 自社名称カナ（未対応）
      f.corp_postal_code || '', // 7. 郵便番号（法人）
      f.corp_prefecture || '', // 8. 都道府県（法人）
      f.corp_city || '', // 9. 市区町村（法人）
      f.corp_address_line || '', // 10. 住所（法人）
      representativeName, // 11. 代表者名
      f.phone_number || '', // 12. 代表電話 = 事業所電話
      '', // 13. 代表FAX（未対応）
      '', // 14. URL（未対応）
      '', // 15. 銀行コード（未対応）
      '', // 16. 支店コード（未対応）
      '', // 17. 口座番号（未対応）
      '', // 18. 口座名義人（未対応）
      '', // 19. 振込依頼人番号（未対応）
      f.smoking_measure || '', // 20. 受動喫煙防止措置
      '', // 21. 事業所番号（未対応）
      f.facility_name || '', // 22. 事業所名称
      f.postal_code || '', // 23. 郵便番号（事業所）
      prefectureCity, // 24. 都道府県／市区町村（事業所）
      f.address_line || '', // 25. 住所（事業所）
      f.phone_number || '', // 26. 電話番号（事業所）
      f.contact_person_last_name || '', // 27. 担当者氏
      f.contact_person_first_name || '', // 28. 担当者名
    ];
  });

  return generateCsv(CLIENT_INFO_HEADERS, rows);
}

/**
 * ヘッダー配列を取得（テスト・検証用）
 */
export function getClientInfoHeaders(): string[] {
  return [...CLIENT_INFO_HEADERS];
}
