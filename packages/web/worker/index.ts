/**
 * Cat Cafe Service Worker — Push Notification Handler
 *
 * Injected into the Workbox-generated sw.js via @ducanh2912/next-pwa's
 * customWorkerSrc convention (worker/index.ts → importScripts).
 *
 * Excluded from the main web tsconfig (uses worker/tsconfig.json with
 * WebWorker lib instead of DOM). @ducanh2912/next-pwa compiles this
 * file separately via its own webpack config.
 */

/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

interface PushData {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
  data?: {
    threadId?: string;
    url?: string;
  };
}

// Push event: 后端 web-push 推过来的通知
self.addEventListener('push', (event: PushEvent) => {
  let payload: PushData = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: '猫猫来信', body: event.data?.text() ?? '' };
  }

  const { title, body, icon, tag, data: notifData } = payload;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If user is actively viewing Cat Cafe, skip system notification
        // (the in-app toast system already handles it)
        const hasFocusedClient = clients.some(
          (c) => c.visibilityState === 'visible',
        );
        if (hasFocusedClient) return;

        return self.registration.showNotification(title ?? '猫猫来信', {
          body: body ?? '',
          icon: icon ?? '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: tag ?? 'cat-cafe-default',
          data: notifData ?? {},
        });
      }),
  );
});

// Notification click: 跳转到对应对话
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as PushData['data'])?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window' })
      .then((clients) => {
        // Find existing Cat Cafe window
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then((focused) => {
              if (focused.url !== new URL(targetUrl, self.location.origin).href) {
                return focused.navigate(targetUrl);
              }
              return focused;
            });
          }
        }
        // No window open — open new
        return self.clients.openWindow(targetUrl);
      }),
  );
});
