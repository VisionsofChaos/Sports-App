const CACHE_NAME = 'a11y-sports-shell-v10';
const RUNTIME = 'a11y-sports-runtime-v10';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if (![CACHE_NAME, RUNTIME].includes(k)) return caches.delete(k);
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // App shell: network-first to ensure updates propagate
  if (url.origin === self.location.origin) {
    if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')))) {
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        }).catch(() => caches.match(req))
      );
      return;
    }
  }

  // Runtime: network-first for ESPN APIs
  if (/site\.api\.espn\.com/.test(url.hostname)) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Images from ESPN CDNs: cache-first for smoother UX
  if (/espncdn\.com$/.test(url.hostname) || /\bespncdn\.com\b/.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then(res => res || caches.match('./index.html')))
  );
});
