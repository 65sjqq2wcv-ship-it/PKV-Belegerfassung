const CACHE_NAME = 'pkv-belege-v1.2';
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

// Update
self.addEventListener('activate', event => {
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
});

// Background Sync (optional für zukünftige Features)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Hier könnten Daten synchronisiert werden
            console.log('Background Sync ausgeführt')
        );
    }
});

// Push Notifications (optional für Erinnerungen)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Neue Benachrichtigung',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-96x96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'App öffnen',
                icon: './icons/checkmark.png'
            },
            {
                action: 'close',
                title: 'Schließen',
                icon: './icons/xmark.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('PKV Belege', options)
    );
});

// Notification Click
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});