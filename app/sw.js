const SW_VERSION = '4.30';

self.addEventListener('install', function() { self.skipWaiting(); });

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) { return Promise.all(keys.map(function(k) { return caches.delete(k); })); })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.mode === 'navigate') {
    const req = new Request(event.request.url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
      cache: 'no-store'
    });
    event.respondWith(fetch(req).catch(function() { return caches.match(event.request); }));
  }
});
