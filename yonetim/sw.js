/* Yönetim paneli service worker'ı (Codex raporu #11, 2026-10-11).
   Yalnız web push gösterir; sayfa önbelleğe almaz.
   Bildirim içeriksiz gelir: metin sabittir, kişi/para bilgisi kilit ekranına düşmez. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  e.waitUntil(self.registration.showNotification('Puffy Yönetim', {
    body: 'İncelemen gereken yeni başvuru var.',
    tag: 'puffy-onay', renotify: true, icon: 'puffy-hands.png', badge: 'puffy-hands.png'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.includes('/yonetim/')) return c.focus();
    return self.clients.openWindow('/yonetim/#onay/bekleyenler');
  }));
});
