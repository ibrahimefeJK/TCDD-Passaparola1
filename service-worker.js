const CACHE = 'tcdd-passaparola-v13';
const ASSETS = [
  './', './index.html', './about.html', './manifest.webmanifest',
  './css/style.css', './css/features.css', './css/about.css',
  './js/defaultQuestions.js', './js/storage.js', './js/gameEngine.js', './js/app.js', './js/features.js',
  './firebase-config.js', './assets/logo.png', './assets/logo192.png', './assets/logo512.png',
  './assets/favicon.png', './assets/favicon.ico'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(response => response || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
