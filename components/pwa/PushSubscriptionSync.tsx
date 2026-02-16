'use client';

import { useEffect, useRef } from 'react';
import {
    isPushNotificationSupported,
    getNotificationPermission,
    subscribeToPushNotifications,
} from '@/lib/push-notification';

interface Props {
    userType: 'worker' | 'facility_admin';
}

/**
 * プッシュ通知の購読状態をサイレントに同期するコンポーネント
 *
 * ページアクセスのたびにDBとの同期を行い、以下のケースを自動修復する:
 * - サーバー側で購読が削除された（403/404/410クリーンアップ）が、ブラウザ側は残っている場合
 * - VAPID鍵がローテーションされ、既存subscriptionが無効になった場合
 * - subscriptionのexpirationTimeが過ぎている場合
 * - 初回登録時にDB保存が失敗していた場合
 *
 * subscribeToPushNotifications() は内部でupsertを行うため、
 * 毎回呼んでも安全（冪等）。
 */
export function PushSubscriptionSync({ userType }: Props) {
    const syncAttempted = useRef(false);

    useEffect(() => {
        if (syncAttempted.current) return;
        syncAttempted.current = true;

        const syncSubscription = async () => {
            if (typeof window === 'undefined') return;
            if (!isPushNotificationSupported()) return;
            if (getNotificationPermission() !== 'granted') return;

            const result = await subscribeToPushNotifications(userType);
            if (result.success) {
                console.log('[PushSync] Subscription synced successfully');
            } else {
                console.warn('[PushSync] Subscription sync failed:', result.error, result.message);
            }
        };

        // ページ読み込み後、少し遅延させて実行（メインの描画を妨げない）
        const timer = setTimeout(syncSubscription, 3000);
        return () => clearTimeout(timer);
    }, [userType]);

    return null;
}
