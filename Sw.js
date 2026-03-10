const CACHE = 'pomodoro-v2';
const ASSETS = ['/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Holds the pending notification timeout
let notifTimer = null;

self.addEventListener('message', e => {
  // Schedule a notification to fire after `delayMs`
  if (e.data?.type === 'SCHEDULE') {
    const { title, body, delayMs } = e.data;
    if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
    if (delayMs > 0) {
      notifTimer = setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          vibrate: [300, 100, 300, 100, 300],
          tag: 'pomodoro',
          renotify: true,
          requireInteraction: false,
          silent: false
        });
        notifTimer = null;
      }, delayMs);
    }
  }

  // Cancel scheduled notification (user paused/reset)
  if (e.data?.type === 'CANCEL') {
    if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
    self.registration.getNotifications({ tag: 'pomodoro' })
      .then(notifs => notifs.forEach(n => n.close()));
  }

  // Immediate notification fallback
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      vibrate: [300, 100, 300],
      tag: 'pomodoro',
      renotify: true,
      requireInteraction: false,
      silent: false
    });
  }
});

// Tap notification → bring app to foreground
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
