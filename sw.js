/* sw.js — Service Worker notifikasi Ciawi Dashboard */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function buildOpts(p) {
  p = p || {};
  return {
    body: p.body || p.isi || '',
    icon: p.icon || '/icon-192.png',
    badge: p.icon || '/icon-192.png',
    timestamp: p.timestamp ? new Date(p.timestamp).getTime() : Date.now(),
    tag: p.tag || 'ciawi-notif',
    data: { url: p.url || '/', aksi: p.aksi || null },
    actions: p.aksi
      ? [{ action: 'open', title: p.aksi }, { action: 'close', title: 'Tutup' }]
      : [{ action: 'open', title: 'Buka Dashboard' }]
  };
}
self.addEventListener('push', function (event) {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { title: 'Ciawi Dashboard', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'Ciawi Dashboard', buildOpts(payload)));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'close') return;
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      if (all[i].url && all[i].url.indexOf(self.location.origin) === 0) { all[i].navigate(url); return all[i].focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});