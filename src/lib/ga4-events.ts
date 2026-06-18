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

/**
 * GA4 User-ID の push 判定（純粋関数・副作用なし）。
 * UserIdDataLayer コンポーネントから利用する。テスト容易性のため切り出している。
 *
 * @param currentId    現在のログインユーザーID（未ログインは null）
 * @param lastPushedId 直近 push 済みの ID（未 push は null）
 * @param isLoading    セッション解決中なら true
 * @param isExcluded   管理者系など対象外ページなら true
 * @returns push するか否かと、次に保持すべき lastPushedId
 *
 * 重要なイレギュラー対応:
 *  - ログアウト/ゲスト（currentId=null）になったら lastPushedId を null にリセットする。
 *    これにより「ログアウト→同一ユーザーで再ログイン」でも再度 push される
 *    （クライアント要望①「新たにログイン状態になった瞬間」を満たす）。
 *  - セッション解決中(isLoading)・対象外ページ(isExcluded)では状態を変更しない
 *    （セッション再取得時の一時的な null で誤ってリセットしないため）。
 */
export function decideUserIdPush(
    currentId: string | null,
    lastPushedId: string | null,
    isLoading: boolean,
    isExcluded: boolean,
): { push: boolean; nextLastPushedId: string | null } {
    if (isLoading || isExcluded) {
        return { push: false, nextLastPushedId: lastPushedId };
    }
    if (!currentId) {
        // ログアウト/ゲスト: 次回ログイン時に再 push できるようリセット
        return { push: false, nextLastPushedId: null };
    }
    if (currentId === lastPushedId) {
        // 同一ユーザーの再レンダリング / SPA 遷移: 重複 push しない
        return { push: false, nextLastPushedId: lastPushedId };
    }
    return { push: true, nextLastPushedId: currentId };
}

/**
 * GA4 User-ID 用の `user_identified` イベントを dataLayer に push する。
 *
 * GTM スニペットは afterInteractive で遅延読み込みされるため、ログイン直後や
 * ページ初回読み込み直後は window.dataLayer が未生成の場合がある。
 * ここで `window.dataLayer = window.dataLayer || []` を自前で初期化してから
 * push することで、GTM 読み込み前に呼ばれても取りこぼさない
 * （GTM はロード時に既存キューを遡って処理するため user_identified トリガーは発火する）。
 *
 * @param userId タスタスのワーカーID（= 内部 User.id の文字列）。ログイン時のみ渡す。
 */
export function pushUserIdentified(userId: string): void {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: 'user_identified',
        user_id: userId,
    });
}

/** 応募種別。GTM/GA4 側で集計を分類するためのパラメータ値。 */
export type ApplyType = 'normal' | 'offer';

/**
 * 応募完了時に送る `job_apply_complete` イベントの「種別」と「発火回数」を決める純粋関数。
 *
 * - 通常応募: 実際に新規作成された応募件数ぶん発火する（重複応募ぶんは含めない）。
 *   `applicationIdsLength` にサーバー戻り値 `applicationIds.length` を渡す。
 *   配列が取得できなかった場合（null）は選択件数 `selectedCount` をフォールバックに使う。
 * - オファー承諾: 単一勤務日への操作のため常に 1 回。
 *
 * @param isOffer              オファー承諾なら true、通常応募なら false
 * @param applicationIdsLength 新規作成された応募件数（取得不可なら null）
 * @param selectedCount        ユーザーが選択した勤務日数（フォールバック用）
 */
export function decideApplyCompleteEvents(
    isOffer: boolean,
    applicationIdsLength: number | null,
    selectedCount: number,
): { applyType: ApplyType; count: number } {
    if (isOffer) {
        return { applyType: 'offer', count: 1 };
    }
    const raw = applicationIdsLength ?? selectedCount;
    // 非有限値(NaN/Infinity)や小数・負値が来ても安全な整数回数に正規化する
    const count = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    return { applyType: 'normal', count };
}
