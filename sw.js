const CACHE_NAME = 'zoi-eats-v6'; // Bumped version to v6 to force universal cache invalidation
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/js/zoi_config.js',
    '/js/zoi_theme.js',
    '/js/db_simulation.js',
    '/js/zoi_customer_engine.js',
    '/js/zoi_location.js',
    'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache v5');
                return cache.addAll(ASSETS_TO_CACHE).catch(err => console.error("Cache add missing assets", err));
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;
    
    // Do not intercept API requests or socket.io
    if (event.request.url.includes('/api/') || event.request.url.includes('socket.io')) {
        return;
    }

    // NETWORK-FIRST STRATEGY (Better for rapidly updating apps)
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                // Clone the response and save to cache for later offline use
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                return response;
            })
            .catch(() => {
                // If Network fails (offline), fallback to cache
                return caches.match(event.request);
            })
    );
});

// PUSH NOTIFICATIONS
self.addEventListener('push', event => {
    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: "ZipZapZoi Update", body: "Check your active orders!" };
    }
    
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081162.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081162.png',
        vibrate: [200, 100, 200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || "ZipZapZoi Food Delivery", options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
