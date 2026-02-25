/**
 * GA4イベント送信ヘルパー
 * GTM dataLayer 経由でGA4にカスタムイベントを送信する
 */

declare global {
    interface Window {
        dataLayer?: Array<Record<string, unknown>>;
    }
}

/**
 * dataLayer にイベントを push する
 * window.dataLayer が存在しない場合（GTM未読み込み時）は何もしない
 */
export function trackGA4Event(eventName: string, params?: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !window.dataLayer) return;
    window.dataLayer.push({
        event: eventName,
        ...params,
    });
}
