/**
 * サービス種別の定数定義（2段階構造）
 * - SERVICE_CATEGORIES: カテゴリ → 詳細サービス種別のマッピング
 * - SERVICE_TYPES: 全サービス種別のフラットリスト
 * - ヘルパー関数: カテゴリ取得、逆引きなど
 */

/**
 * サービスカテゴリと詳細サービス種別のマッピング
 */
export const SERVICE_CATEGORIES = {
  '入所系介護施設': [
    '特別養護老人ホーム',
    '介護老人保健施設',
    '介護付き有料老人ホーム',
    '住宅型有料老人ホーム',
    'サービス付き高齢者向け住宅',
    '認知症対応型共同生活介護',
    '短期入所生活介護',
    '軽費老人ホーム',
    '養護老人ホーム',
    '介護医療院',
  ],
  '通所系介護サービス': [
    '通所介護',
    '通所リハビリテーション',
    '小規模多機能型居宅介護',
    '看護小規模多機能型居宅介護',
  ],
  '訪問系介護サービス': [
    '訪問介護',
    '訪問入浴介護',
    '訪問看護',
    '定期巡回・随時対応型訪問介護看護',
  ],
  '居宅支援・相談': [
    '居宅介護支援',
    '地域包括支援センター',
    '福祉用具貸与・販売',
  ],
  '障がい者支援': [
    '障がい者支援施設',
    '障がい者グループホーム',
    '放課後等デイサービス',
  ],
  '病院・医療機関': [
    '病院 (回復期リハ)',
    '病院 (地域包括ケア)',
    '病院 (急性期一般)',
    '病院 (療養)',
    '病院 (医療療養)',
    '病院 (精神)',
    '病院 (障がい・特殊疾患)',
    '病院 (外来)',
    '病院 (ICU/HCU)',
    '病院 (OPE室)',
    '病院 (緩和ケア病棟)',
    '病院 (薬剤課)',
  ],
  'クリニック・診療所': [
    'クリニック',
    '有床クリニック',
    '検診センター',
  ],
  'その他': [
    '保育園',
    '薬局',
    '自費サービス',
  ],
} as const;

/**
 * カテゴリ名の型
 */
export type ServiceCategory = keyof typeof SERVICE_CATEGORIES;

/**
 * 全カテゴリ名のリスト
 */
export const SERVICE_CATEGORY_LIST = Object.keys(SERVICE_CATEGORIES) as ServiceCategory[];

/**
 * 全サービス種別のフラットリスト（施設登録などで使用）
 */
export const SERVICE_TYPES = Object.values(SERVICE_CATEGORIES).flat();

/**
 * サービス種別の型
 */
export type ServiceType = typeof SERVICE_TYPES[number];

/**
 * 詳細サービス種別からカテゴリを逆引き
 */
export function getCategoryByServiceType(serviceType: string): ServiceCategory | null {
  for (const [category, types] of Object.entries(SERVICE_CATEGORIES)) {
    if ((types as readonly string[]).includes(serviceType)) {
      return category as ServiceCategory;
    }
  }
  return null;
}

/**
 * カテゴリから詳細サービス種別リストを取得
 */
export function getServiceTypesByCategory(category: ServiceCategory): readonly string[] {
  return SERVICE_CATEGORIES[category] || [];
}

/**
 * カテゴリに属する詳細サービス種別かどうか判定
 */
export function isServiceTypeInCategory(serviceType: string, category: ServiceCategory): boolean {
  const types = SERVICE_CATEGORIES[category];
  return types ? (types as readonly string[]).includes(serviceType) : false;
}

/**
 * 複数カテゴリに対応する詳細サービス種別リストを取得
 */
export function getServiceTypesByCategories(categories: ServiceCategory[]): string[] {
  return categories.flatMap(cat => [...SERVICE_CATEGORIES[cat]]);
}

/**
 * 後方互換性: 旧FACILITY_TYPESの代替
 * システム管理画面のフィルターなどで使用
 */
export const FACILITY_TYPE_CATEGORIES = SERVICE_CATEGORY_LIST;
