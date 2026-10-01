const SW_VERSION = '10.0';
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
