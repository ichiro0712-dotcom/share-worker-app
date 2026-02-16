'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getServiceWorkerRegistration,
  isIOS,
  isStandaloneMode,
} from '@/lib/push-notification';

type PermissionState = 'loading' | 'unsupported' | 'denied' | 'default' | 'granted' | 'subscribed';

export default function NotificationSettingsClient() {
  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    checkPermissionState();
  }, []);

  const checkPermissionState = async () => {
    // プッシュ通知サポートチェック
    if (!isPushNotificationSupported()) {
      setPermissionState('unsupported');
      return;
    }

    // iOS PWAチェック
    if (isIOS() && !isStandaloneMode()) {
      setShowIOSHint(true);
    }

    // 現在の許可状態を取得
    const permission = getNotificationPermission();
    if (permission === 'unsupported') {
      setPermissionState('unsupported');
      return;
    }

    if (permission === 'denied') {
      setPermissionState('denied');
      return;
    }

    if (permission === 'granted') {
      // 購読済みかどうかをチェック
      const registration = await getServiceWorkerRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          setPermissionState('subscribed');
          return;
        }
      }
      setPermissionState('granted');
      return;
    }

    setPermissionState('default');
  };

  const handleEnableNotifications = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // 通知許可をリクエスト
      const permission = await requestNotificationPermission();

      if (permission === 'denied') {
        setPermissionState('denied');
        setError('通知がブロックされています。ブラウザの設定から許可してください。');
        return;
      }

      if (permission === 'granted') {
        // プッシュ通知を購読
        const result = await subscribeToPushNotifications('worker');
        if (result.success) {
          setPermissionState('subscribed');
        } else {
          setError(result.message);
        }
      }
    } catch (err) {
      console.error('Notification error:', err);
      setError('エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const success = await unsubscribeFromPushNotifications();
      if (success) {
        setPermissionState('granted');
      } else {
        setError('通知の解除に失敗しました。');
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError('エラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderContent = () => {
    switch (permissionState) {
      case 'loading':
        return (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        );

      case 'unsupported':
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  このブラウザはプッシュ通知に対応していません
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Chrome、Firefox、Safari（iOS 16.4以降）などの最新ブラウザをお使いください。
                </p>
              </div>
            </div>
          </div>
        );

      case 'denied':
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <BellOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  通知がブロックされています
                </p>
                <p className="text-sm text-red-700 mt-1">
                  ブラウザの設定から通知を許可してください。
                </p>
                <p className="text-xs text-red-600 mt-2">
                  設定方法: ブラウザのアドレスバー左の鍵アイコン → 通知 → 許可
                </p>
              </div>
            </div>
          </div>
        );

      case 'default':
      case 'granted':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    プッシュ通知を有効にしましょう
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    新着メッセージや応募状況の更新をリアルタイムでお知らせします。
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleEnableNotifications}
              disabled={isProcessing}
              className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  設定中...
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  通知を有効にする
                </>
              )}
            </button>
          </div>
        );

      case 'subscribed':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    プッシュ通知が有効です
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    新着メッセージや応募状況の更新をお知らせします。
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDisableNotifications}
              disabled={isProcessing}
              className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  解除中...
                </>
              ) : (
                <>
                  <BellOff className="w-5 h-5" />
                  通知を無効にする
                </>
              )}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* プッシュ通知セクション */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-gray-600" />
          プッシュ通知
        </h2>

        {renderContent()}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* iOSヒント */}
      {showIOSHint && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                iPhoneでプッシュ通知を受け取るには
              </p>
              <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
                <li>Safari下部の共有ボタン(□↑)をタップ</li>
                <li>「ホーム画面に追加」を選択</li>
                <li>追加されたアプリから通知を有効化</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 通知の種類説明 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold mb-3">通知の種類</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>施設からの新着メッセージ</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>応募状況の更新（採用・不採用など）</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>レビュー投稿のお願い</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>重要なお知らせ</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
