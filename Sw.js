const CACHE = 'pomodoro-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Background timer tick messages from the page
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    const { title, body, icon } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-512.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'pomodoro',
      renotify: true,
      requireInteraction: false,
      silent: false
    });
  }
});

// Handle notification click — bring the app to focus
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('pomodoro') || c.url.endsWith('/')) {
          return c.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
