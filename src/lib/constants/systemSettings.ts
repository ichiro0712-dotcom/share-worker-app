// システム設定のキー定数
export const SYSTEM_SETTING_KEYS = {
  // 距離ソート時に自動距離フィルターを適用するか
  DISTANCE_SORT_FILTER_ENABLED: 'distance_sort_filter_enabled',
  // 距離フィルターのデフォルト距離（km）
  DISTANCE_SORT_DEFAULT_KM: 'distance_sort_default_km',
  // Resend APIヘッダーからキャッシュした月間送信数
  RESEND_QUOTA_HEADER_CACHE: 'resend_quota_header_cache',
  // Cron集計結果（JSON: dbCount, apiQuotaUsed, effectiveCount, checkedAt）
  RESEND_EMAIL_MONTHLY_COUNT: 'resend_email_monthly_count',
} as const;

// デフォルト値
export const SYSTEM_SETTING_DEFAULTS: Record<string, string> = {
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_FILTER_ENABLED]: 'false',
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_DEFAULT_KM]: '50',
  [SYSTEM_SETTING_KEYS.RESEND_QUOTA_HEADER_CACHE]: '0',
  [SYSTEM_SETTING_KEYS.RESEND_EMAIL_MONTHLY_COUNT]: '',
};

// 設定キーの説明
export const SYSTEM_SETTING_DESCRIPTIONS: Record<string, string> = {
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_FILTER_ENABLED]:
    '「近い順」ソート時に自動で距離フィルターを適用するか',
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_DEFAULT_KM]:
    '距離フィルターのデフォルト距離（km）',
  [SYSTEM_SETTING_KEYS.RESEND_QUOTA_HEADER_CACHE]:
    'Resend APIレスポンスヘッダーから取得した月間送信数',
  [SYSTEM_SETTING_KEYS.RESEND_EMAIL_MONTHLY_COUNT]:
    'Resendメール月間送信数（cron集計結果JSON）',
};
