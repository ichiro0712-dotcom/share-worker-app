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

// Service Workerがactivated状態になるまで待機するヘルパー
function waitForSWActivation(sw: ServiceWorker, timeoutMs: number): Promise<boolean> {
    if (sw.state === 'activated') return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            sw.removeEventListener('statechange', onStateChange);
            resolve(false);
        }, timeoutMs);
        const onStateChange = () => {
            if (sw.state === 'activated') {
                clearTimeout(timer);
                sw.removeEventListener('statechange', onStateChange);
                resolve(true);
            } else if (sw.state === 'redundant') {
                clearTimeout(timer);
                sw.removeEventListener('statechange', onStateChange);
                resolve(false);
            }
        };
        sw.addEventListener('statechange', onStateChange);
    });
}

// Service Workerの登録状態を取得（タイムアウト付き）
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('[SW] Service Worker not supported');
        return null;
    }

    try {
        // PWAプラグインが自動登録中の場合があるため、リトライ付きで取得
        let registration = await navigator.serviceWorker.getRegistration();

        if (!registration) {
            console.log('[SW] No registration found, waiting for PWA plugin...');
            // PWAプラグインの自動登録を少し待つ
            await new Promise(r => setTimeout(r, 1500));
            registration = await navigator.serviceWorker.getRegistration();
        }

        if (!registration) {
            console.log('[SW] Still no registration, manually registering...');
            try {
                registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('[SW] Manual registration succeeded');
            } catch (regError) {
                console.error('[SW] Manual registration failed:', regError);
                return null;
            }
        }

        // SWがまだinstalling/waiting状態なら、activatedになるまで待つ
        const activeSW = registration.active;
        if (activeSW && activeSW.state === 'activated') {
            console.log('[SW] Already activated');
            return registration;
        }

        const pendingSW = registration.installing || registration.waiting || registration.active;
        if (pendingSW) {
            console.log('[SW] Waiting for activation, current state:', pendingSW.state);
            const activated = await waitForSWActivation(pendingSW, 20000);
            if (activated) {
                console.log('[SW] Activation complete');
                // registration.activeが更新されるのを待つため再取得
                const freshReg = await navigator.serviceWorker.getRegistration();
                return freshReg || registration;
            }
            console.error('[SW] Activation timed out');
        }

        // フォールバック: navigator.serviceWorker.readyを待機（20秒タイムアウト）
        console.log('[SW] Falling back to navigator.serviceWorker.ready');
        const readyRegistration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>(resolve => setTimeout(() => resolve(null), 20000))
        ]);

        if (!readyRegistration) {
            console.error('[SW] ready timed out after 20s');
            return null;
        }

        return readyRegistration;
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
        // 既存の購読があるか確認
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // 新規購読
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
                });
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
            const errorBody = await response.text().catch(() => '');
            console.error('Push subscribe API error:', response.status, errorBody);
            return {
                success: false,
                error: 'API_FAILED',
                message: 'サーバーへの登録に失敗しました。しばらくしてからお試しください。',
            };
        }

        console.log('Push notification subscribed successfully');
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
