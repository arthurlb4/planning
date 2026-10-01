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
  // Pages : la copie gardée s'affiche tout de suite, la version du serveur est récupérée en arrière-plan
  // (la page compare sa version et se recharge si besoin). Sans copie : réseau.
  if (req.mode === 'navigate') {
    const key = req.url.split('?')[0].split('#')[0];
    const fresh = new Request(req.url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
      cache: 'no-store'
    });
    const net = fetch(fresh).then(function(res) {
      if (res && res.ok) { const copy = res.clone(); caches.open(PAGES).then(function(c) { c.put(key, copy); }); }
      return res;
    });
    event.respondWith(
      caches.match(key, { cacheName: PAGES }).then(function(hit) {
        if (hit) { event.waitUntil(net.catch(function() {})); return hit; }
        return net.catch(function() { return caches.match(req); });
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
