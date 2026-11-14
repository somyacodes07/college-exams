const CACHE_NAME = 'exam-scheduler-v7';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.svg'
];

self.addEventListener('install', (event) => {
    // Activate immediately without waiting for existing tabs to close
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', (event) => {
    // Clear out old caches and claim all clients immediately
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass caching for API requests
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Network-First for HTML/navigation requests so user always gets the latest deployed version
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Only fingerprinted build files (/assets/name-HASH.ext) never change, so
    // only they are served cache-first. Anything else goes to the network
    // first, so a stale copy can never stick (this also keeps dev servers fresh).
    if (event.request.method !== 'GET') return;
    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return res;
            }))
        );
        return;
    }

    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

