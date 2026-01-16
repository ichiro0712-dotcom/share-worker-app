// システム設定のキー定数
export const SYSTEM_SETTING_KEYS = {
  // 距離ソート時に自動距離フィルターを適用するか
  DISTANCE_SORT_FILTER_ENABLED: 'distance_sort_filter_enabled',
  // 距離フィルターのデフォルト距離（km）
  DISTANCE_SORT_DEFAULT_KM: 'distance_sort_default_km',
} as const;

// デフォルト値
export const SYSTEM_SETTING_DEFAULTS: Record<string, string> = {
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_FILTER_ENABLED]: 'false',
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_DEFAULT_KM]: '50',
};

// 設定キーの説明
export const SYSTEM_SETTING_DESCRIPTIONS: Record<string, string> = {
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_FILTER_ENABLED]:
    '「近い順」ソート時に自動で距離フィルターを適用するか',
  [SYSTEM_SETTING_KEYS.DISTANCE_SORT_DEFAULT_KM]:
    '距離フィルターのデフォルト距離（km）',
};
