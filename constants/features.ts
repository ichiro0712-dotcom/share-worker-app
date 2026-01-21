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
} as const;

/**
 * フィーチャーフラグのデフォルト値
 * 環境変数が未設定の場合に使用
 */
export const FEATURE_DEFAULTS = {
  BANK_SEARCH_ENABLED: false,
} as const;

/**
 * フィーチャーフラグを取得するヘルパー関数
 */
export function isFeatureEnabled(featureName: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[featureName] ?? FEATURE_DEFAULTS[featureName] ?? false;
}
