'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    isPushNotificationSupported,
    isStandaloneMode,
    isIOS,
    getNotificationPermission,
    requestNotificationPermission,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
} from '@/lib/push-notification';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface Props {
    userType: 'worker' | 'facility_admin';
}

export function NotificationButton({ userType }: Props) {
    const { showDebugError } = useDebugError();
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
    const [isLoading, setIsLoading] = useState(false);
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        const supported = isPushNotificationSupported();
        setIsSupported(supported);

        if (supported) {
            setPermission(getNotificationPermission());
        }

        // iOSの場合はスタンドアロンモードでのみ表示
        // その他のブラウザは常に表示
        if (isIOS()) {
            setShowButton(isStandaloneMode() && supported);
        } else {
            setShowButton(supported);
        }
    }, []);

    const handleToggle = async () => {
        if (permission === 'granted') {
            // 購読解除
            setIsLoading(true);
            const success = await unsubscribeFromPushNotifications();
            setIsLoading(false);

            if (success) {
                // permissionは変わらないが、UIを更新するために再チェック
                setPermission('default');
            } else {
                showDebugError({
                    type: 'other',
                    operation: 'プッシュ通知解除',
                    message: '通知の解除に失敗しました',
                });
                toast.error('通知の解除に失敗しました');
            }
        } else {
            // 購読開始
            setIsLoading(true);

            const perm = await requestNotificationPermission();
            setPermission(perm);

            if (perm === 'granted') {
                const subscription = await subscribeToPushNotifications(userType);
                if (subscription) {
                    toast.success('通知を有効にしました');
                } else {
                    showDebugError({
                        type: 'save',
                        operation: 'プッシュ通知登録',
                        message: '通知の登録に失敗しました',
                        context: { userType }
                    });
                    toast.error('通知の登録に失敗しました');
                }
            } else {
                toast.error('通知が許可されませんでした');
            }

            setIsLoading(false);
        }
    };

    if (!showButton) return null;

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors
        ${permission === 'granted'
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
      `}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : permission === 'granted' ? (
                <Bell className="w-4 h-4" />
            ) : (
                <BellOff className="w-4 h-4" />
            )}
            {permission === 'granted' ? '通知オン' : '通知オフ'}
        </button>
    );
}
