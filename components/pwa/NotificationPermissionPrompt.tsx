'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    isPushNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    subscribeToPushNotifications,
    isIOSNonStandalone,
} from '@/lib/push-notification';

interface Props {
    userType: 'worker' | 'facility_admin';
}

const STORAGE_KEYS = {
    PROMPT_COUNT: 'notification_prompt_count',
    DISMISSED_AT: 'notification_prompt_dismissed_at',
    NEVER_SHOW: 'notification_prompt_never_show',
};

// 「後で」を押した後、再表示するまでの日数
const DISMISS_DAYS = 7;

export function NotificationPermissionPrompt({ userType }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [promptCount, setPromptCount] = useState(0);

    // 表示条件をチェック
    const checkShouldShow = useCallback(() => {
        // サーバーサイドでは何もしない
        if (typeof window === 'undefined') return false;

        // プッシュ通知がサポートされていない
        if (!isPushNotificationSupported()) return false;

        // 既に許可済み
        if (getNotificationPermission() === 'granted') return false;

        // ブラウザで拒否された（設定で解除しない限り再リクエスト不可）
        if (getNotificationPermission() === 'denied') return false;

        // 「不要」を選択済み
        const neverShow = localStorage.getItem(STORAGE_KEYS.NEVER_SHOW);
        if (neverShow === 'true') return false;

        // 「後で」を選択してからの経過時間をチェック
        const dismissedAt = localStorage.getItem(STORAGE_KEYS.DISMISSED_AT);
        if (dismissedAt) {
            const dismissedTime = parseInt(dismissedAt, 10);
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < DISMISS_DAYS) return false;
        }

        return true;
    }, []);

    useEffect(() => {
        // 少し遅延させてから表示（ページ読み込み直後は避ける）
        const timer = setTimeout(() => {
            if (checkShouldShow()) {
                const count = parseInt(localStorage.getItem(STORAGE_KEYS.PROMPT_COUNT) || '0', 10);
                setPromptCount(count);
                setIsVisible(true);
                // 表示回数をインクリメント
                localStorage.setItem(STORAGE_KEYS.PROMPT_COUNT, String(count + 1));
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [checkShouldShow]);

    // 「通知を有効化」ボタン
    const handleEnable = async () => {
        // iOSブラウザ（非PWA）の場合は早期にガイド表示
        if (isIOSNonStandalone()) {
            toast.error(
                'iOSではホーム画面に追加してから通知を有効にしてください。\n共有ボタン → 「ホーム画面に追加」',
                { duration: 6000 }
            );
            setIsVisible(false);
            return;
        }

        setIsLoading(true);
        try {
            const permission = await requestNotificationPermission();
            if (permission === 'granted') {
                const result = await subscribeToPushNotifications(userType);
                if (result.success) {
                    toast.success('通知を有効にしました');
                    localStorage.removeItem(STORAGE_KEYS.PROMPT_COUNT);
                    localStorage.removeItem(STORAGE_KEYS.DISMISSED_AT);
                } else {
                    console.error('Push subscription failed:', result.error, result.message);
                    toast.error(result.message, { duration: 5000 });
                }
            } else if (permission === 'denied') {
                toast.error('通知がブロックされています。ブラウザの設定から許可してください。', { duration: 5000 });
            } else {
                toast.error('通知が許可されませんでした');
            }
        } catch (error) {
            console.error('Notification enable error:', error);
            toast.error('エラーが発生しました');
        } finally {
            setIsLoading(false);
            setIsVisible(false);
        }
    };

    // 「後で」ボタン
    const handleLater = () => {
        localStorage.setItem(STORAGE_KEYS.DISMISSED_AT, String(Date.now()));
        setIsVisible(false);
    };

    // 「不要」ボタン（2回目以降のみ表示）
    const handleNeverShow = () => {
        localStorage.setItem(STORAGE_KEYS.NEVER_SHOW, 'true');
        setIsVisible(false);
        toast('通知設定はマイページからいつでも変更できます', {
            icon: '💡',
            duration: 4000,
        });
    };

    // 閉じるボタン（×）
    const handleClose = () => {
        handleLater();
    };

    if (!isVisible) return null;

    const isFirstTime = promptCount === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* モーダル */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                {/* 閉じるボタン */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="閉じる"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* アイコン */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Bell className="w-8 h-8 text-indigo-600" />
                    </div>
                </div>

                {/* タイトル */}
                <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
                    通知を有効にしますか？
                </h2>

                {/* 説明文 */}
                <p className="text-sm text-gray-600 text-center mb-6">
                    {userType === 'worker' ? (
                        <>
                            新しいお仕事のマッチングや<br />
                            メッセージをすぐにお届けします
                        </>
                    ) : (
                        <>
                            新しい応募やメッセージを<br />
                            すぐにお届けします
                        </>
                    )}
                </p>

                {/* ボタン群 */}
                <div className="space-y-3">
                    {/* メインボタン: 通知を有効化 */}
                    <button
                        onClick={handleEnable}
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? '設定中...' : '通知を有効にする'}
                    </button>

                    {/* サブボタン: 後で */}
                    <button
                        onClick={handleLater}
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        後で
                    </button>

                    {/* 2回目以降のみ表示: 不要ボタン */}
                    {!isFirstTime && (
                        <button
                            onClick={handleNeverShow}
                            disabled={isLoading}
                            className="w-full py-2 px-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            今後表示しない
                        </button>
                    )}
                </div>

                {/* 補足テキスト */}
                <p className="text-xs text-gray-400 text-center mt-4">
                    設定はいつでもマイページから変更できます
                </p>
            </div>
        </div>
    );
}
