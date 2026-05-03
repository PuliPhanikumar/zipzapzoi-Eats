/**
 * ════════════════════════════════════════════════════
 * ZipZapZoi Eats — API Bridge Layer
 * ════════════════════════════════════════════════════
 * This module bridges frontend ↔ backend.
 * Pattern: Try real API first → fallback to db_simulation.js
 *
 * Include AFTER zoi_config.js and db_simulation.js:
 *   <script src="js/zoi_config.js"></script>
 *   <script src="js/db_simulation.js"></script>
 *   <script src="js/zoi_api.js"></script>
 */
(function () {
    'use strict';

    // ─── HEALTH CHECK ──────────────────────────────────────
    let _backendAlive = null; // null = unknown, true/false = tested
    let _lastHealthCheck = 0;
    const HEALTH_CACHE_MS = 30000; // 30 seconds

    async function isBackendAlive() {
        const now = Date.now();
        if (_backendAlive !== null && now - _lastHealthCheck < HEALTH_CACHE_MS) {
            return _backendAlive;
        }
        try {
            const res = await fetch(`${getApiBase()}/health`, { signal: AbortSignal.timeout(3000) });
            _backendAlive = res.ok;
        } catch (e) {
            _backendAlive = false;
        }
        _lastHealthCheck = now;
        return _backendAlive;
    }

    function getApiBase() {
        return typeof ZOI_CONFIG !== 'undefined'
            ? ZOI_CONFIG.API_BASE_URL
            : 'http://localhost:5000/api';
    }

    function getHeaders() {
        const h = { 'Content-Type': 'application/json' };
        const token = typeof ZoiToken !== 'undefined' ? ZoiToken.get() : null;
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    }

    async function apiFetch(path, options = {}) {
        const url = getApiBase() + path;
        const headers = { ...getHeaders(), ...(options.headers || {}) };
        if (options.body instanceof FormData) delete headers['Content-Type'];
        const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    // ─── STATUS INDICATOR ──────────────────────────────────
    function showConnectionStatus(online) {
        let badge = document.getElementById('zoi-api-status');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'zoi-api-status';
            badge.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99999;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;font-family:Manrope,sans-serif;transition:all 0.3s;pointer-events:none;';
            document.body.appendChild(badge);
        }
        if (online) {
            badge.textContent = '🟢 Live';
            badge.style.background = 'rgba(5,150,105,0.2)';
            badge.style.color = '#34d399';
            badge.style.border = '1px solid #05966944';
        } else {
            badge.textContent = '🟡 Offline Mode';
            badge.style.background = 'rgba(245,158,11,0.2)';
            badge.style.color = '#fbbf24';
            badge.style.border = '1px solid #f59e0b44';
        }
        // Auto-hide after 5 seconds
        setTimeout(() => { if (badge) badge.style.opacity = '0.4'; }, 5000);
    }

    // ════════════════════════════════════════════════════════
    //  ZoiAPI — Unified Data Access Layer
    // ════════════════════════════════════════════════════════

    const ZoiAPI = {

        // ─── AUTH ────────────────────────────────────────────
        auth: {
            register: async (data) => {
                return apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            login: async (data) => {
                const result = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                if (result.token) {
                    ZoiToken.set(result.token);
                    // Sync to customer engine
                    if (result.user) {
                        localStorage.setItem('zoiCustomerSession', JSON.stringify(result.user));
                        localStorage.setItem('zoiUser', JSON.stringify(result.user));
                    }
                }
                return result;
            },
            loginOtp: async (phone) => {
                return apiFetch('/auth/otp/send', {
                    method: 'POST',
                    body: JSON.stringify({ phone })
                });
            },
            verifyOtp: async (phone, otp) => {
                const result = await apiFetch('/auth/otp/verify', {
                    method: 'POST',
                    body: JSON.stringify({ phone, otp })
                });
                if (result.token) {
                    ZoiToken.set(result.token);
                    if (result.user) {
                        localStorage.setItem('zoiCustomerSession', JSON.stringify(result.user));
                    }
                }
                return result;
            },
            loginGoogle: async (credential) => {
                const result = await apiFetch('/auth/google', {
                    method: 'POST',
                    body: JSON.stringify({ credential })
                });
                if (result.token) {
                    ZoiToken.set(result.token);
                    if (result.user) {
                        localStorage.setItem('zoiCustomerSession', JSON.stringify(result.user));
                    }
                }
                return result;
            },
            me: async () => {
                try {
                    return await apiFetch('/auth/me');
                } catch (e) {
                    // Fallback to local
                    return typeof ZoiCustomer !== 'undefined' && ZoiCustomer.getSession
                        ? ZoiCustomer.getSession()
                        : JSON.parse(localStorage.getItem('zoiCustomerSession') || 'null');
                }
            },
            updateProfile: async (data) => {
                return apiFetch('/auth/me', {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            },
            logout: () => {
                if (typeof ZoiToken !== 'undefined') ZoiToken.remove();
                localStorage.removeItem('zoiCustomerSession');
                localStorage.removeItem('zoiUser');
                localStorage.removeItem('zoiAuthToken');
            }
        },

        // ─── RESTAURANTS ────────────────────────────────────
        restaurants: {
            getAll: async () => {
                try {
                    const data = await apiFetch('/restaurants');
                    // Map API format to frontend format
                    const mapped = (Array.isArray(data) ? data : []).map(r => ({
                        id: String(r.id),
                        name: r.name,
                        image: r.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg',
                        tags: r.tags || [],
                        rating: r.rating || 4.0,
                        time: r.deliveryTime || '30 min',
                        cost: r.costForTwo || '₹300 for two',
                        promoted: r.promoted || false,
                        offer: r.offer || null,
                        status: r.status || 'Active',
                        zone: r.zone
                    }));
                    // Cache locally for offline use
                    localStorage.setItem('zoiRest', JSON.stringify(mapped));
                    return mapped;
                } catch (e) {
                    // Fallback to db_simulation
                    return typeof ZoiRestaurants !== 'undefined'
                        ? ZoiRestaurants.getAll()
                        : (typeof DB_RESTAURANTS !== 'undefined' ? DB_RESTAURANTS : []);
                }
            },
            getById: async (id) => {
                try {
                    return await apiFetch(`/restaurants/${id}`);
                } catch (e) {
                    const all = typeof ZoiRestaurants !== 'undefined'
                        ? ZoiRestaurants.getAll()
                        : (typeof DB_RESTAURANTS !== 'undefined' ? DB_RESTAURANTS : []);
                    return all.find(r => String(r.id) === String(id)) || null;
                }
            },
            create: async (data) => {
                return apiFetch('/restaurants', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── MENUS ──────────────────────────────────────────
        menus: {
            getByRestaurant: async (restaurantId) => {
                try {
                    const data = await apiFetch(`/menus/${restaurantId}`);
                    // Map to frontend format
                    return (Array.isArray(data) ? data : []).map(m => ({
                        id: m.id,
                        name: m.itemName,
                        price: m.price,
                        desc: m.description || '',
                        img: m.image || '',
                        veg: m.type === 'Veg',
                        spicy: false,
                        category: m.category,
                        bestseller: m.isBestseller,
                        available: m.isAvailable,
                        nutrition: m.nutrition
                    }));
                } catch (e) {
                    // Fallback to db_simulation
                    const menus = typeof DB_MENUS !== 'undefined' ? DB_MENUS : {};
                    return menus[String(restaurantId)] || [];
                }
            },
            create: async (data) => {
                return apiFetch('/menus', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/menus/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            },
            delete: async (id) => {
                return apiFetch(`/menus/${id}`, { method: 'DELETE' });
            }
        },

        // ─── ORDERS ─────────────────────────────────────────
        orders: {
            getAll: async (filters = {}) => {
                try {
                    const params = new URLSearchParams(filters).toString();
                    const data = await apiFetch(`/orders${params ? '?' + params : ''}`);
                    return data.data || data || [];
                } catch (e) {
                    return typeof ZoiOrders !== 'undefined'
                        ? ZoiOrders.getAll()
                        : JSON.parse(localStorage.getItem('zoiCompletedOrders') || '[]');
                }
            },
            getById: async (id) => {
                try {
                    return await apiFetch(`/orders/${id}`);
                } catch (e) {
                    const all = typeof ZoiOrders !== 'undefined' ? ZoiOrders.getAll() : [];
                    return all.find(o => o.id === id || o.orderId === id) || null;
                }
            },
            getByUser: async (userId) => {
                try {
                    return await apiFetch(`/orders/user/${userId}`);
                } catch (e) {
                    return JSON.parse(localStorage.getItem('zoiCompletedOrders') || '[]');
                }
            },
            create: async (orderPayload) => {
                try {
                    const result = await apiFetch('/orders', {
                        method: 'POST',
                        body: JSON.stringify({
                            restaurantId: parseInt(orderPayload.restaurantId) || 1,
                            items: JSON.stringify(orderPayload.items),
                            totalAmount: orderPayload.total,
                            deliveryAddress: orderPayload.address || orderPayload.deliveryAddress,
                            zone: orderPayload.zone || 'Default',
                            type: orderPayload.type || 'Delivery',
                            paymentMethod: orderPayload.paymentMethod || 'UPI'
                        })
                    });
                    return result;
                } catch (e) {
                    // Fallback: save locally
                    if (typeof ZoiOrders !== 'undefined') {
                        return ZoiOrders.place(orderPayload);
                    }
                    return { error: 'Could not place order. Backend offline.' };
                }
            },
            updateStatus: async (id, status) => {
                try {
                    return await apiFetch(`/orders/${id}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({ status })
                    });
                } catch (e) {
                    if (typeof ZoiOrders !== 'undefined') {
                        return ZoiOrders.updateStatus(id, status);
                    }
                    return null;
                }
            }
        },

        // ─── PAYMENTS ────────────────────────────────────────
        payments: {
            getConfig: async () => {
                return apiFetch('/payments/config');
            },
            createOrder: async (amount, currency = 'INR') => {
                return apiFetch('/payments/create-order', {
                    method: 'POST',
                    body: JSON.stringify({ amount, currency })
                });
            },
            verify: async (paymentData) => {
                return apiFetch('/payments/verify', {
                    method: 'POST',
                    body: JSON.stringify(paymentData)
                });
            }
        },

        // ─── FEEDBACK ───────────────────────────────────────
        feedback: {
            getAll: async () => {
                try {
                    return await apiFetch('/feedback');
                } catch (e) {
                    return JSON.parse(localStorage.getItem('zoiFeedback') || '[]');
                }
            },
            submit: async (data) => {
                try {
                    return await apiFetch('/feedback', {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                } catch (e) {
                    // Local fallback
                    const fb = JSON.parse(localStorage.getItem('zoiFeedback') || '[]');
                    fb.push({ ...data, id: Date.now(), createdAt: new Date().toISOString() });
                    localStorage.setItem('zoiFeedback', JSON.stringify(fb));
                    return { success: true, offline: true };
                }
            }
        },

        // ─── REVIEWS ────────────────────────────────────────
        reviews: {
            getByRestaurant: async (restaurantId) => {
                try {
                    return await apiFetch(`/reviews/${restaurantId}`);
                } catch (e) {
                    return [];
                }
            },
            submit: async (data) => {
                return apiFetch('/reviews', { method: 'POST', body: JSON.stringify(data) });
            }
        },

        // ─── DISPUTES / SUPPORT ─────────────────────────────
        disputes: {
            getAll: async () => {
                try {
                    return await apiFetch('/disputes');
                } catch (e) {
                    return typeof ZoiDisputes !== 'undefined' ? ZoiDisputes.getAll() : [];
                }
            },
            getById: async (id) => {
                try {
                    return await apiFetch(`/disputes/${id}`);
                } catch (e) {
                    const all = typeof ZoiDisputes !== 'undefined' ? ZoiDisputes.getAll() : [];
                    return all.find(d => d.id == id) || null;
                }
            },
            create: async (data) => {
                return apiFetch('/disputes', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/disputes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
            }
        },

        supportTickets: {
            getAll: async () => {
                try {
                    return await apiFetch('/support-tickets');
                } catch (e) {
                    return [];
                }
            },
            create: async (data) => {
                return apiFetch('/support-tickets', { method: 'POST', body: JSON.stringify(data) });
            }
        },

        // ─── PROMOTIONS ─────────────────────────────────────
        promotions: {
            getAll: async () => {
                try {
                    return await apiFetch('/promotions');
                } catch (e) {
                    return typeof ZoiPromos !== 'undefined' ? ZoiPromos.getAll() : [];
                }
            },
            validate: async (code) => {
                return apiFetch('/promotions/validate', {
                    method: 'POST',
                    body: JSON.stringify({ code })
                });
            },
            create: async (data) => {
                return apiFetch('/promotions', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── SUBSCRIPTIONS ──────────────────────────────────
        subscriptions: {
            getAll: async () => {
                try {
                    return await apiFetch('/subscriptions');
                } catch (e) {
                    return typeof ZoiSubscriptions !== 'undefined' ? ZoiSubscriptions.getAll() : [];
                }
            },
            create: async (data) => {
                return apiFetch('/subscriptions', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── ZONES ──────────────────────────────────────────
        zones: {
            getAll: async () => {
                try {
                    return await apiFetch('/zones');
                } catch (e) {
                    return typeof ZoiZones !== 'undefined' ? ZoiZones.getAll() : [];
                }
            },
            create: async (data) => {
                return apiFetch('/zones', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/zones/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── USERS (ADMIN) ──────────────────────────────────
        users: {
            getAll: async () => {
                try {
                    return await apiFetch('/users');
                } catch (e) {
                    return typeof ZoiUsers !== 'undefined' ? ZoiUsers.getAll() : [];
                }
            },
            updateStatus: async (id, status) => {
                return apiFetch(`/users/${id}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status })
                });
            },
            updateRole: async (id, role) => {
                return apiFetch(`/users/${id}/role`, {
                    method: 'PATCH',
                    body: JSON.stringify({ role })
                });
            }
        },

        // ─── REFUNDS (ADMIN) ────────────────────────────────
        refunds: {
            getAll: async () => {
                try {
                    return await apiFetch('/refunds');
                } catch (e) {
                    return typeof ZoiRefunds !== 'undefined' ? ZoiRefunds.getAll() : [];
                }
            },
            create: async (data) => {
                return apiFetch('/refunds', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/refunds/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── INVENTORY ──────────────────────────────────────
        inventory: {
            getByRestaurant: async (restaurantId) => {
                try {
                    return await apiFetch(`/inventory/${restaurantId}`);
                } catch (e) {
                    return typeof ZoiInventory !== 'undefined'
                        ? ZoiInventory.getByRestaurant(restaurantId)
                        : [];
                }
            },
            create: async (data) => {
                return apiFetch('/inventory', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── RIDER APPLICATIONS ─────────────────────────────
        riderApplications: {
            getAll: async () => {
                try {
                    return await apiFetch('/rider-applications');
                } catch (e) {
                    return typeof ZoiRiderOnboarding !== 'undefined'
                        ? ZoiRiderOnboarding.getAll() : [];
                }
            },
            submit: async (data) => {
                return apiFetch('/rider-applications', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/rider-applications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── RESTAURANT APPLICATIONS ────────────────────────
        restaurantApplications: {
            getAll: async () => {
                try {
                    return await apiFetch('/restaurant-applications');
                } catch (e) {
                    return [];
                }
            },
            submit: async (data) => {
                return apiFetch('/restaurant-applications', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/restaurant-applications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
        },

        // ─── CMS ────────────────────────────────────────────
        cms: {
            getAll: async () => {
                try {
                    return await apiFetch('/cms');
                } catch (e) {
                    return typeof ZoiCMS !== 'undefined' ? ZoiCMS.getAll() : [];
                }
            },
            create: async (data) => {
                return apiFetch('/cms', { method: 'POST', body: JSON.stringify(data) });
            }
        },

        // ─── BADGES (GAMIFICATION) ──────────────────────────
        badges: {
            getAll: async () => {
                try {
                    return await apiFetch('/badges');
                } catch (e) {
                    return typeof ZoiGamification !== 'undefined' ? ZoiGamification.getAll() : [];
                }
            },
            create: async (data) => {
                return apiFetch('/badges', { method: 'POST', body: JSON.stringify(data) });
            }
        },

        // ─── ADMIN METRICS ──────────────────────────────────
        admin: {
            getMetrics: async () => {
                try {
                    return await apiFetch('/admin/metrics');
                } catch (e) {
                    return {
                        totalUsers: 0, totalRestaurants: 0,
                        totalOrders: 0, totalRevenue: 0,
                        activeRiders: 0, pendingDisputes: 0
                    };
                }
            }
        },

        // ─── SEARCH ─────────────────────────────────────────
        search: async (query) => {
            try {
                return await apiFetch(`/search?q=${encodeURIComponent(query)}`);
            } catch (e) {
                // Local search fallback
                const q = query.toLowerCase();
                const restaurants = typeof DB_RESTAURANTS !== 'undefined' ? DB_RESTAURANTS : [];
                return {
                    restaurants: restaurants.filter(r =>
                        r.name.toLowerCase().includes(q) ||
                        r.tags.some(t => t.toLowerCase().includes(q))
                    )
                };
            }
        },

        // ─── FILE UPLOAD ────────────────────────────────────
        upload: async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return apiFetch('/upload', { method: 'POST', body: formData });
        },

        // ─── PUSH NOTIFICATIONS ─────────────────────────────
        notifications: {
            subscribe: async (subscription) => {
                return apiFetch('/notifications/subscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription)
                });
            },
            testPush: async (title, body) => {
                return apiFetch('/notifications/test', {
                    method: 'POST',
                    body: JSON.stringify({ title, body })
                });
            }
        },

        // ─── WALLET ─────────────────────────────────────────
        wallet: {
            get: async (entityId) => {
                try {
                    return await apiFetch(`/wallet/${entityId}`);
                } catch (e) {
                    return { balance: 0, transactions: [] };
                }
            },
            withdraw: async (entityId, amount) => {
                return apiFetch(`/wallet/${entityId}/withdraw`, {
                    method: 'POST',
                    body: JSON.stringify({ amount })
                });
            }
        },

        // ─── FAVORITES ─────────────────────────────────────
        favorites: {
            list: async () => {
                try {
                    return await apiFetch('/favorites');
                } catch (e) { return []; }
            },
            toggle: async (type, restaurantId = null, menuItemId = null) => {
                return apiFetch('/favorites/toggle', {
                    method: 'POST',
                    body: JSON.stringify({ type, restaurantId, menuItemId })
                });
            }
        },

        // ─── ADDRESSES ─────────────────────────────────────
        addresses: {
            list: async () => {
                try {
                    return await apiFetch('/addresses');
                } catch (e) { return []; }
            },
            create: async (data) => {
                return apiFetch('/addresses', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            update: async (id, data) => {
                return apiFetch(`/addresses/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            },
            delete: async (id) => {
                return apiFetch(`/addresses/${id}`, { method: 'DELETE' });
            }
        },

        // ─── IN-APP NOTIFICATIONS ──────────────────────────
        inAppNotifications: {
            list: async (page = 1, limit = 20) => {
                try {
                    return await apiFetch(`/notifications?page=${page}&limit=${limit}`);
                } catch (e) { return { data: [], unreadCount: 0, pagination: {} }; }
            },
            markRead: async (id) => {
                return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            },
            markAllRead: async () => {
                return apiFetch('/notifications/read-all', { method: 'POST' });
            }
        },

        // ─── ORDER RATINGS ─────────────────────────────────
        orderRatings: {
            submit: async (orderId, foodRating, deliveryRating, comment) => {
                return apiFetch('/order-ratings', {
                    method: 'POST',
                    body: JSON.stringify({ orderId, foodRating, deliveryRating, comment })
                });
            },
            get: async (orderId) => {
                try {
                    return await apiFetch(`/order-ratings/${orderId}`);
                } catch (e) { return null; }
            }
        },

        // ─── ORDER ACTIONS ─────────────────────────────────
        orderActions: {
            cancel: async (orderId, reason) => {
                return apiFetch(`/orders/${orderId}/cancel`, {
                    method: 'POST',
                    body: JSON.stringify({ reason })
                });
            },
            trackGuest: async (zoiId) => {
                try {
                    return await apiFetch(`/orders/track/${zoiId}`);
                } catch (e) { return null; }
            }
        },

        // ─── TABLES ─────────────────────────────────────────
        tables: {
            getByRestaurant: async (restaurantId) => {
                try {
                    return await apiFetch(`/restaurants/${restaurantId}/tables`);
                } catch (e) {
                    return [];
                }
            },
            create: async (data) => {
                return apiFetch('/tables', { method: 'POST', body: JSON.stringify(data) });
            },
            update: async (id, data) => {
                return apiFetch(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
            },
            delete: async (id) => {
                return apiFetch(`/tables/${id}`, { method: 'DELETE' });
            }
        },

        // ─── UTILITIES ──────────────────────────────────────
        isOnline: isBackendAlive,

        /**
         * Smart data fetcher: API with localStorage fallback.
         * @param {string} apiPath - API route
         * @param {string} localKey - localStorage key
         * @param {*} defaultValue - fallback if both fail
         */
        smartFetch: async (apiPath, localKey, defaultValue = []) => {
            try {
                const data = await apiFetch(apiPath);
                if (localKey) localStorage.setItem(localKey, JSON.stringify(data));
                return data;
            } catch (e) {
                if (localKey) {
                    try {
                        return JSON.parse(localStorage.getItem(localKey)) || defaultValue;
                    } catch (e2) { }
                }
                return defaultValue;
            }
        }
    };

    // ─── EXPOSE GLOBALLY ────────────────────────────────────
    window.ZoiAPI = ZoiAPI;

    // ─── AUTO HEALTH CHECK ON LOAD ──────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            const alive = await isBackendAlive();
            showConnectionStatus(alive);
            if (alive) console.log('🟢 ZoiAPI: Backend connected at', getApiBase());
            else console.warn('🟡 ZoiAPI: Backend offline — using local mock data');
        });
    } else {
        isBackendAlive().then(alive => {
            showConnectionStatus(alive);
            if (alive) console.log('🟢 ZoiAPI: Backend connected at', getApiBase());
            else console.warn('🟡 ZoiAPI: Backend offline — using local mock data');
        });
    }

})();
