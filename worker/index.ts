/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// プッシュ通知受信イベント
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  if (!event.data) {
    console.log('[SW] No push data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: '新着通知', body: event.data.text() };
  }

  const title = data.title || '+TASTAS';
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'default',
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

export {};
