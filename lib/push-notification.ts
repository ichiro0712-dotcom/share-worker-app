// プッシュ通知のユーティリティ関数

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// プッシュ通知サブスクリプションのエラー種別
export type PushSubscriptionError =
    | 'VAPID_KEY_MISSING'
    | 'SW_NOT_SUPPORTED'
    | 'SW_REGISTRATION_FAILED'
    | 'SW_TIMEOUT'
    | 'PUSH_NOT_ALLOWED'
    | 'PUSH_SUBSCRIBE_FAILED'
    | 'API_FAILED'
    | 'UNKNOWN';

export type PushSubscriptionResult =
    | { success: true; subscription: PushSubscription }
    | { success: false; error: PushSubscriptionError; message: string };

// Base64をUint8Arrayに変換
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// SW取得タイムアウト（5秒に短縮）
const SW_READY_TIMEOUT_MS = 5000;

// Service Workerの登録状態を取得（シンプル版）
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('[SW] Service Worker not supported');
        return null;
    }

    try {
        // まず既存の登録を即座にチェック（待機なし）
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing?.active) {
            console.log('[SW] Already active');
            return existing;
        }

        // なければnavigator.serviceWorker.readyを使う（ブラウザが自動で待ってくれる）
        console.log('[SW] Waiting for ready...');
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>(resolve =>
                setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)
            ),
        ]);

        if (registration) {
            console.log('[SW] Ready');
            return registration;
        }

        // タイムアウト時: 手動登録を試みる
        console.log('[SW] Timeout, manually registering...');
        try {
            const manualReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            // 登録後にreadyを短時間待つ
            const readyReg = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
            ]);
            return readyReg || manualReg;
        } catch (regError) {
            console.error('[SW] Manual registration failed:', regError);
            return null;
        }
    } catch (error) {
        console.error('[SW] Registration error:', error);
        return null;
    }
}

// プッシュ通知がサポートされているか
export function isPushNotificationSupported(): boolean {
    return 'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
}

// PWA（スタンドアロン）モードかどうか
export function isStandaloneMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
}

// iOS判定
export function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// 通知許可状態を取得
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

// 通知許可をリクエスト
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
}

// iOSかつスタンドアロンモードでないかチェック
// iPadOS（デスクトップUAモード）も検出する
export function isIOSNonStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // iPadOSはデスクトップ版SafariのUAを返すため、タッチポイント数で判定
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (!isIOSDevice && !isIPadOS) return false;
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
    return !standalone;
}

// サーバーに購読情報を同期
async function syncSubscriptionToServer(
    subscription: PushSubscription,
    userType: 'worker' | 'facility_admin'
): Promise<boolean> {
    const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
            userType,
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error('[Push] Subscribe API error:', response.status, errorBody);
        return false;
    }
    return true;
}

// プッシュ通知を購読（結果オブジェクトで返す）
export async function subscribeToPushNotifications(
    userType: 'worker' | 'facility_admin'
): Promise<PushSubscriptionResult> {
    if (!VAPID_PUBLIC_KEY) {
        console.error('VAPID public key not found');
        return { success: false, error: 'VAPID_KEY_MISSING', message: 'VAPID公開鍵が設定されていません' };
    }

    // iOSブラウザ（非PWA）ではプッシュ通知が使えない
    if (isIOSNonStandalone()) {
        return {
            success: false,
            error: 'PUSH_NOT_ALLOWED',
            message: 'iOSでは「ホーム画面に追加」してからお試しください',
        };
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
        return { success: false, error: 'SW_REGISTRATION_FAILED', message: 'サービスワーカーの準備に失敗しました。ページを再読み込みしてください。' };
    }

    try {
        // 既存の購読があればそのまま再利用（破棄しない）
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('[Push] Reusing existing subscription');
            const synced = await syncSubscriptionToServer(existingSubscription, userType);
            if (synced) {
                return { success: true, subscription: existingSubscription };
            }
            // サーバー同期失敗時のみ、新規作成にフォールバック
            console.warn('[Push] Server sync failed, creating new subscription');
            await existingSubscription.unsubscribe().catch(() => {});
        }

        // 新規購読を作成
        let subscription: PushSubscription;
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
            console.log('[Push] New subscription created');
        } catch (subscribeError: any) {
            console.error('pushManager.subscribe() failed:', subscribeError);
            if (subscribeError?.name === 'NotAllowedError') {
                return {
                    success: false,
                    error: 'PUSH_NOT_ALLOWED',
                    message: 'プッシュ通知が許可されていません。ブラウザの設定を確認してください。',
                };
            }
            return {
                success: false,
                error: 'PUSH_SUBSCRIBE_FAILED',
                message: `通知の購読に失敗しました: ${subscribeError?.message || '不明なエラー'}`,
            };
        }

        // サーバーに購読情報を送信
        const synced = await syncSubscriptionToServer(subscription, userType);
        if (!synced) {
            return {
                success: false,
                error: 'API_FAILED',
                message: 'サーバーへの登録に失敗しました。しばらくしてからお試しください。',
            };
        }

        console.log('[Push] Subscription registered successfully');
        return { success: true, subscription };
    } catch (error: any) {
        console.error('Push subscription error:', error);
        return {
            success: false,
            error: 'UNKNOWN',
            message: `通知の登録中にエラーが発生しました: ${error?.message || '不明なエラー'}`,
        };
    }
}

// プッシュ通知の購読を解除
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
        return false;
    }

    try {
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // サーバーから購読情報を削除
            const response = await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                }),
            });

            if (!response.ok) {
                console.error('[Push] Unsubscribe API failed:', response.status);
                return false;
            }

            // ブラウザの購読を解除
            await subscription.unsubscribe();
        }

        return true;
    } catch (error) {
        console.error('Push unsubscription error:', error);
        return false;
    }
}
