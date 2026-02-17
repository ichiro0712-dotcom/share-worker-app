/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// プッシュ通知受信イベント
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  if (!event.data) {
    console.log('[SW] No push data, showing fallback notification');
    event.waitUntil(
      self.registration.showNotification('+タスタス', {
        body: '新しいお知らせがあります',
        icon: '/icons/icon-192x192.png',
        tag: `fallback-${Date.now()}`,
        data: { url: '/' },
      })
    );
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: '新着通知', body: event.data.text() };
  }

  const title = data.title || '+タスタス';
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || `notification-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: {
      url: data.url || '/',
    },
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知クリックイベント
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 既に開いているウィンドウがあればフォーカス
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // 開いているウィンドウがなければ新規に開く
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// 通知を閉じたイベント
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// 購読が変更された時（iOSが購読を無効化した場合などに発火）
self.addEventListener('pushsubscriptionchange', ((event: Event) => {
  const pushEvent = event as PushSubscriptionChangeEvent;
  console.log('[SW] Push subscription changed, re-subscribing...');

  const resubscribe = async () => {
    try {
      const newSubscription = await self.registration.pushManager.subscribe(
        pushEvent.oldSubscription?.options || {
          userVisibleOnly: true,
        }
      );
      // サーバーに新しい購読を送信
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          userType: 'worker', // SW内ではuserTypeを特定できないためworkerをデフォルトに
        }),
      });
      console.log('[SW] Re-subscription successful');
    } catch (error) {
      console.error('[SW] Re-subscription failed:', error);
    }
  };

  (event as ExtendableEvent).waitUntil(resubscribe());
}) as EventListener);

// pushsubscriptionchange の型定義（標準のTypeScript定義にまだ含まれていない）
interface PushSubscriptionChangeEvent extends Event {
  oldSubscription?: PushSubscription;
  newSubscription?: PushSubscription;
}

export {};
