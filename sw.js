const CACHE_NAME = 'pkv-belege-v1.12';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './logo.png',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

// Installation
self.addEventListener('install', event => {
    console.log('Service Worker installiert - Version 1.5');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache geöffnet');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Fehler beim Cachen der Dateien:', error);
            })
    );
    // Sofortige Aktivierung für Updates
    self.skipWaiting();
});

// Fetch Events
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});

// Update - lösche alte Caches
self.addEventListener('activate', event => {
    console.log('Service Worker aktiviert - Version 1.5');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Übernehme sofort die Kontrolle über alle Clients
    return self.clients.claim();
});

// Message Handler für Update-Benachrichtigungen
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background Sync (optional für zukünftige Features)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            console.log('Background Sync ausgeführt')
        );
    }
});

// Push Notifications mit Update-Support
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'PKV Belege wurde aktualisiert!',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-96x96.png',
        vibrate: [100, 50, 100],
        tag: 'pkv-update',
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            type: 'update'
        },
        actions: [
            {
                action: 'explore',
                title: 'App öffnen',
                icon: './icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Später',
                icon: './icons/icon-96x96.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('PKV Belege', options)
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});

// Version Check für Update-Banner
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            type: 'VERSION_INFO',
            version: '1.5',
            cacheVersion: CACHE_NAME
        });
    }
});