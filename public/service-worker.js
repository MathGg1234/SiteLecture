const CACHE_STATIC = 'lt-static-v2';
const CACHE_RUNTIME = 'lt-runtime-v2';
const STATIC_ASSETS = ['./','./index.html','./style.css','./app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![CACHE_STATIC, CACHE_RUNTIME].includes(k)).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (event) => {
  const req = event.request; const url = new URL(req.url);
  if (STATIC_ASSETS.some(p => url.pathname.endsWith(p.replace('./','/public/')) || url.pathname.endsWith(p.replace('./','/')))) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE_STATIC).then(cache => cache.put(req, copy)); return res; }))); return;
  }
  if (url.pathname.endsWith('/api/index.php')) {
    event.respondWith(caches.open(CACHE_RUNTIME).then(cache => fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => cache.match(req)))); return;
  }
});