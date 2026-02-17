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
 * ページアクセス時に既存の購読をサーバーDBと同期する。
 * 既存の購読は破棄せずそのまま再利用する（APNsのエンドポイント伝播問題を回避）。
 * 購読がない場合のみ新規作成する。
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
