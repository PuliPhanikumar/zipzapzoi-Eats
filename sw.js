const CACHE_NAME = 'zoi-eats-v8';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/customer_restaurant_listing.html',
    '/shopping_cart.html',
    '/restaurant_menu.html',
    '/login & registration.html',
    '/customer_orders history.html',
    '/customer profile.html',
    '/search_results.html',
    '/promotions & offers.html',
    '/about us.html',
    '/restaurant_partner_dashboard.html',
    '/restaurant_live_orders_kds.html',
    '/restaurant_menu_manager.html',
    '/restaurant_financials.html',
    '/rider_dashboard.html',
    '/admin console dashboard V2.html',
    '/js/zoi_config.js',
    '/js/zoi_theme.js',
    '/js/zoi_pwa.js',
    '/js/db_simulation.js',
    '/js/zoi_customer_engine.js',
    '/js/zoi_location.js',
    '/js/zoi_api.js',
    '/js/zoi_partner_engine.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Opened cache v8');
                return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('[SW] Some assets failed to cache:', err));
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(cacheNames.map(name => name !== CACHE_NAME ? caches.delete(name) : undefined))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/') || event.request.url.includes('socket.io')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (!response || response.status !== 200) return response;
                if (new URL(event.request.url).origin === location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() =>
                caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                    return new Response('', { status: 503, statusText: 'Offline' });
                })
            )
    );
});

// BACKGROUND SYNC — queue offline order status updates
self.addEventListener('sync', event => {
    if (event.tag === 'sync-order-status') {
        event.waitUntil(
            (async () => {
                try {
                    const queue = JSON.parse(await (await caches.open('zoi-sync')).match('/sync-queue')?.text() || '[]');
                    for (const item of queue) {
                        await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
                    }
                    // Clear queue on success
                    const syncCache = await caches.open('zoi-sync');
                    await syncCache.put('/sync-queue', new Response('[]'));
                } catch (e) { console.warn('[SW] Background sync failed, will retry', e); }
            })()
        );
    }
});

// PUSH NOTIFICATIONS
self.addEventListener('push', event => {
    let data;
    try { data = event.data.json(); } catch (e) { data = { title: 'ZipZapZoi Update', body: 'Check your active orders!' }; }
    event.waitUntil(
        self.registration.showNotification(data.title || 'ZipZapZoi Food Delivery', {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081162.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081162.png',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' },
            actions: [
                { action: 'open', title: 'View' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
