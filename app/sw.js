const SW_VERSION = '10.8';
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
  // Pages : la dernière version si le réseau répond en moins de 1,2 s, sinon la copie gardée (pas d'écran blanc sans réseau) ;
  // la dernière version est mise de côté en même temps.
  // Rechargement demandé (actualiser) ou pas encore de copie : réseau d'abord.
  if (req.mode === 'navigate') {
    const key = req.url.split('?')[0];
    const fresh = new Request(req.url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
      cache: 'no-store'
    });
    const net = fetch(fresh).then(function(res) {
      if (res && res.ok) { const copy = res.clone(); return caches.open(PAGES).then(function(c) { return c.put(key, copy); }).then(function() { return res; }); }
      return res;
    });
    event.waitUntil(net.catch(function() {}));
    const fromNet = function() { return net.catch(function() { return caches.match(key, { cacheName: PAGES }).then(function(r) { return r || caches.match(req); }); }); };
    // rechargement demandé, ou passage à une nouvelle version (?upd=) : réseau d'abord, jamais la copie gardée
    if (req.cache === 'reload' || req.cache === 'no-cache' || req.cache === 'no-store' || /[?&]upd=/.test(req.url)) { event.respondWith(fromNet()); return; }
    // Ouverture : la dernière version si le réseau répond vite (l'image de démarrage couvre l'attente), sinon la copie gardée
    event.respondWith(caches.match(key, { cacheName: PAGES }).then(function(hit) {
      if (!hit) return fromNet();
      return Promise.race([net.then(function(r) { return r && r.ok ? r : hit; }, function() { return hit; }), new Promise(function(res) { setTimeout(function() { res(hit); }, 1200); })]);
    }));
    return;
  }
  // Fichiers partagés de l'app (core.js, ui.js, style.css…) : adresse versionnée (?v=), donc gardés tels quels ;
  // une nouvelle version a une nouvelle adresse, chargée par le réseau puis gardée à son tour (ouverture hors connexion)
  const u = new URL(req.url);
  if (u.origin === self.location.origin && /\/app\/(pc\/)?[\w-]+\.(js|css)$/.test(u.pathname) && !/sw\.js$/.test(u.pathname)) {
    event.respondWith(caches.open(PAGES).then(function(c) {
      return c.match(req).then(function(hit) {
        if (hit && u.search) return hit;
        return fetch(req).then(function(res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function() { return hit || c.match(req, { ignoreSearch: true }); });
      });
    }));
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
    icon: './apple-touch-icon-v10.png',
    badge: './favicon11.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { if (/[?&]swap=1/.test(url)) list[i].postMessage({ open: 'swap' }); return list[i].focus(); } }
    return clients.openWindow(url);
  }));
});
