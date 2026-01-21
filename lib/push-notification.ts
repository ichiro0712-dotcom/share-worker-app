// プッシュ通知のユーティリティ関数

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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

// Service Workerの登録状態を取得（タイムアウト付き）
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return null;
    }

    try {
        // 既に登録済みのService Workerがあるか確認
        const existingRegistration = await navigator.serviceWorker.getRegistration();

        if (!existingRegistration) {
            console.log('No Service Worker registered, attempting to register...');
            // Service Workerが登録されていない場合は登録を試みる
            try {
                await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('Service Worker registered successfully');
            } catch (regError) {
                console.error('Service Worker registration failed:', regError);
                return null;
            }
        }

        // タイムアウト付きでreadyを待機（10秒）
        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
                console.error('Service Worker ready timeout - took too long to activate');
                resolve(null);
            }, 10000);
        });

        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            timeoutPromise
        ]);

        if (!registration) {
            console.error('Service Worker did not become ready in time');
            return null;
        }

        return registration;
    } catch (error) {
        console.error('Service Worker registration error:', error);
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

// プッシュ通知を購読
export async function subscribeToPushNotifications(
    userType: 'worker' | 'facility_admin'
): Promise<PushSubscription | null> {
    if (!VAPID_PUBLIC_KEY) {
        console.error('VAPID public key not found');
        return null;
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
        return null;
    }

    try {
        // 既存の購読があるか確認
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // 新規購読
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
        }

        // サーバーに購読情報を送信
        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                userType,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save subscription on server');
        }

        console.log('Push notification subscribed:', subscription);
        return subscription;
    } catch (error) {
        console.error('Push subscription error:', error);
        return null;
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
            await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                }),
            });

            // ブラウザの購読を解除
            await subscription.unsubscribe();
        }

        return true;
    } catch (error) {
        console.error('Push unsubscription error:', error);
        return false;
    }
}
