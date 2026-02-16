'use client';

import { useEffect, useRef } from 'react';
import {
    isPushNotificationSupported,
    getNotificationPermission,
    subscribeToPushNotifications,
    getServiceWorkerRegistration,
} from '@/lib/push-notification';

interface Props {
    userType: 'worker' | 'facility_admin';
}

// 同一セッション内で重複実行を防ぐフラグ
const SYNC_KEY = 'push_subscription_last_sync';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間に1回

/**
 * プッシュ通知の購読状態をサイレントに同期するコンポーネント
 *
 * 以下のケースを自動修復する:
 * - VAPID鍵がローテーションされ、既存subscriptionが無効になった場合
 * - サーバー側で購読が削除された（403/404/410クリーンアップ）が、ブラウザ側は残っている場合
 * - subscriptionのexpirationTimeが過ぎている場合
 *
 * subscribeToPushNotifications() 内にVAPID鍵検証+期限切れチェックが
 * 実装済みのため、この関数を呼ぶだけで上記全てが処理される。
 */
export function PushSubscriptionSync({ userType }: Props) {
    const syncAttempted = useRef(false);

    useEffect(() => {
        // 同一レンダーでの重複実行防止
        if (syncAttempted.current) return;
        syncAttempted.current = true;

        const syncSubscription = async () => {
            // 基本チェック
            if (typeof window === 'undefined') return;
            if (!isPushNotificationSupported()) return;
            if (getNotificationPermission() !== 'granted') return;

            // 24時間以内に同期済みならスキップ
            const lastSync = localStorage.getItem(SYNC_KEY);
            if (lastSync) {
                const elapsed = Date.now() - parseInt(lastSync, 10);
                if (elapsed < SYNC_INTERVAL_MS) return;
            }

            // SW登録があるか確認（なければ同期不要）
            const registration = await getServiceWorkerRegistration();
            if (!registration) return;

            // ブラウザ側にsubscriptionがあるか確認
            const existingSubscription = await registration.pushManager.getSubscription();
            if (!existingSubscription) {
                // ブラウザ側にsubscriptionがない→新規作成が必要
                console.log('[PushSync] No browser subscription found, re-subscribing...');
            }

            // subscribeToPushNotifications() は内部で:
            // 1. VAPID鍵の一致チェック（不一致→unsubscribe→再subscribe）
            // 2. expirationTimeチェック（期限切れ→unsubscribe→再subscribe）
            // 3. サーバーへの購読情報送信（upsert）
            // を行うので、呼ぶだけで全ての同期が完了する
            const result = await subscribeToPushNotifications(userType);
            if (result.success) {
                console.log('[PushSync] Subscription synced successfully');
                localStorage.setItem(SYNC_KEY, String(Date.now()));
            } else {
                console.warn('[PushSync] Subscription sync failed:', result.error, result.message);
            }
        };

        // ページ読み込み後、少し遅延させて実行（メインの描画を妨げない）
        const timer = setTimeout(syncSubscription, 5000);
        return () => clearTimeout(timer);
    }, [userType]);

    // UIは描画しない
    return null;
}
