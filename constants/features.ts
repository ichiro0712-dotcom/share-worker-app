/**
 * フィーチャーフラグ設定
 *
 * 新機能のリリース管理に使用
 * 環境変数でオーバーライド可能
 */

export const FEATURE_FLAGS = {
  /**
   * 銀行口座検索機能
   * true: 新しい検索ベースのUIを使用
   * false: 従来のテキスト入力UIを使用
   */
  BANK_SEARCH_ENABLED: process.env.NEXT_PUBLIC_ENABLE_BANK_SEARCH === 'true',

  /**
   * 選考あり求人機能（応募後に施設が採用/不採用を判断する方式）
   * true: 求人作成時に「審査してからマッチング」を選択可能
   * false: 機能を無効化（新規求人は即時マッチングのみ）
   *
   * 要件定義が固まり次第このフラグをONにして再開する想定のため、
   * OFFでもDBカラム・処理ロジック・既存求人の動作は温存している。
   * 既存の選考あり求人は引き続き「採用/不採用」まで処理可能。
   */
  SELECTION_JOB_ENABLED: process.env.NEXT_PUBLIC_ENABLE_SELECTION_JOB === 'true',
} as const;

/**
 * フィーチャーフラグのデフォルト値
 * 環境変数が未設定の場合に使用
 */
export const FEATURE_DEFAULTS = {
  BANK_SEARCH_ENABLED: false,
  SELECTION_JOB_ENABLED: false,
} as const;

/**
 * フィーチャーフラグを取得するヘルパー関数
 */
export function isFeatureEnabled(featureName: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[featureName] ?? FEATURE_DEFAULTS[featureName] ?? false;
}
