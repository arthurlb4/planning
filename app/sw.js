const SW_VERSION = '10.1';
const PAGES = 'pl-pages-v1';   // dernière version de l'app, pour l'ouvrir hors connexion
const ASSETS = 'pl-assets-v1'; // icônes (CDN)

self.addEventListener('install', function() { self.skipWaiting(); });

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) { return Promise.all(keys.filter(function(k) { return k !== PAGES && k !== ASSETS; }).map(function(k) { return caches.delete(k); })); })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Pages : réseau d'abord (toujours la dernière version), copie gardée pour le hors connexion
  if (req.mode === 'navigate') {
    const fresh = new Request(req.url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
      cache: 'no-store'
    });
    event.respondWith(
      fetch(fresh).then(function(res) {
        if (res && res.ok) { const copy = res.clone(); caches.open(PAGES).then(function(c) { c.put(req.url.split('?')[0], copy); }); }
        return res;
      }).catch(function() {
        return caches.match(req.url.split('?')[0], { cacheName: PAGES }).then(function(r) { return r || caches.match(req); });
      })
    );
    return;
  }
  // Icônes (feuille de style + polices du CDN) : cache d'abord, mise à jour en arrière-plan
  if (/cdn\.jsdelivr\.net\/npm\/@tabler\//.test(req.url)) {
    event.respondWith(
      caches.open(ASSETS).then(function(c) {
        return c.match(req).then(function(hit) {
          const net = fetch(req).then(function(res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function() { return hit; });
          return hit || net;
        });
      })
    );
  }
  // Le reste (données, Google…) passe directement par le réseau
});

// Notifications push (rappels d'expiration envoyés par le serveur)
self.addEventListener('push', function(event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Planning', {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: './apple-touch-icon-v8.png',
    badge: './favicon9.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) return list[i].focus(); }
    return clients.openWindow(url);
  }));
});
