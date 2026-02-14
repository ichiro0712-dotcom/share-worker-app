// タグ検出用の正規表現パターン（HTML保存・チェックAPI・サーバーアクション共通）
export const TAG_PATTERNS = {
  GTM: /googletagmanager\.com|GTM-[A-Z0-9]+/i,
  TRACKING: /tracking\.js|\/api\/lp-tracking/i,
};

/**
 * HTMLをスキャンしてタグ有無を判定
 */
export function scanHtmlForTags(html: string) {
  return {
    has_gtm: TAG_PATTERNS.GTM.test(html),
    has_tracking: TAG_PATTERNS.TRACKING.test(html),
  };
}
