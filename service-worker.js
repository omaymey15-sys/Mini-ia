const CACHE_NAME = 'minichatgpt-v5-';
const VERSION = '5.0.0';
const FULL_CACHE = CACHE_NAME + VERSION;

const CRITICAL_ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './ai/orchestrator.js',
  './ai/ia0.js', './ai/ia1.js', './ai/ia2.js', './ai/ia3.js', './ai/ia4.js',
  './ai/ia5.js', './ai/ia6.js', './ai/ia7.js', './ai/ia8.js', './ai/ia9.js',
  './ai/ia10.js', './ai/ia11.js', './ai/ia12.js', './ai/ia13.js', './ai/ia14.js',
  './ai/ia15.js', './ai/ia16.js', './ai/ia17.js', './ai/ia18.js', './ai/ia19.js',
  './data/storage.js', './data/memory.js', './data/web-search.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(FULL_CACHE).then(cache => cache.addAll(CRITICAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_NAME) && key !== FULL_CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(FULL_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
  );
});
