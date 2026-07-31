const CACHE = 'aadhaar-hub-v1';
const SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    './favicon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// App shell: network first (taaki nayi build turant mile), offline par cache.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    event.respondWith(
        fetch(req)
            .then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(cache => cache.put(req, copy));
                return res;
            })
            .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
});
