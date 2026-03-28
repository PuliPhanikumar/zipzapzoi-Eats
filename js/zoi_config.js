/**
 * ════════════════════════════════════════════════════
 * ZipZapZoi Eats — Global Frontend Configuration
 * ════════════════════════════════════════════════════
 * Include this BEFORE all other JS files on every page.
 * Provides: API URL, Socket URL, auth helpers, API wrapper.
 *
 * Usage: <script src="js/zoi_config.js"></script>
 */
(function () {
    'use strict';

    // ─── ENVIRONMENT DETECTION ──────────────────────────
    const hostname = window.location.hostname;
    const isLocalhost = ['localhost', '127.0.0.1', ''].includes(hostname);
    const isFileProtocol = window.location.protocol === 'file:';

    // ─── CONFIGURATION ─────────────────────────────────
    const ZOI_CONFIG = {
        // Auto-detect: use localhost for dev, production URL for deployed
        API_BASE_URL: isLocalhost || isFileProtocol
            ? 'http://localhost:5000/api'
            : `${window.location.protocol}//${hostname}/api`,

        SOCKET_URL: isLocalhost || isFileProtocol
            ? 'http://localhost:5000'
            : `${window.location.protocol}//${hostname}`,

        RAZORPAY_KEY_ID: '', // Loaded dynamically from backend /api/payments/config

        GOOGLE_CLIENT_ID: '', // Set if using Google OAuth

        APP_VERSION: '2.0.0',
        DEMO_MODE: true // Set to false in production
    };

    // Fetch payment config from backend (key_id only, never the secret)
    (async function loadPaymentConfig() {
        try {
            const res = await fetch(
                (isLocalhost || isFileProtocol ? 'http://localhost:5000/api' : `${window.location.protocol}//${hostname}/api`)
                + '/payments/config',
                { signal: AbortSignal.timeout(3000) }
            );
            if (res.ok) {
                const cfg = await res.json();
                if (cfg.key_id) ZOI_CONFIG.RAZORPAY_KEY_ID = cfg.key_id;
                if (cfg.is_live) console.log('%c 💳 Razorpay LIVE Mode ', 'background:#059669;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px');
            }
        } catch (e) {
            // Backend offline — payment will fail gracefully
        }
    })();

    // ─── PRODUCTION LOGGING ────────────────────────────
    if (!ZOI_CONFIG.DEMO_MODE) {
        if (typeof console !== 'undefined') {
            ['log', 'debug', 'info'].forEach(method => {
                console[method] = function() {};
            });
        }
    }

    // ─── TOKEN MANAGEMENT ──────────────────────────────
    const ZoiToken = {
        KEY: 'zoiAuthToken',

        get: () => localStorage.getItem('zoiAuthToken'),

        set: (token) => localStorage.setItem('zoiAuthToken', token),

        remove: () => localStorage.removeItem('zoiAuthToken'),

        /** Decode JWT payload (without verification — just for display) */
        decode: () => {
            const token = ZoiToken.get();
            if (!token) return null;
            try {
                let base64Url = token.split('.')[1];
                let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                // Decode base64 and handle UTF-8 chars
                let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const payload = JSON.parse(jsonPayload);
                // Check expiry
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    ZoiToken.remove();
                    return null;
                }
                return payload;
            } catch (e) {
                return null;
            }
        },

        isValid: () => !!ZoiToken.decode(),

        /** Get user data from token */
        getUser: () => {
            const payload = ZoiToken.decode();
            if (!payload) return null;
            return {
                id: payload.id,
                name: payload.name,
                role: payload.role,
                zoiId: payload.zoiId,
                email: payload.email
            };
        }
    };

    // ─── API WRAPPER ────────────────────────────────────
    /**
     * Authenticated API fetch wrapper.
     * Automatically includes JWT token and handles common errors.
     *
     * @param {string} path - API path (e.g., '/orders' or '/auth/login')
     * @param {object} options - fetch options (method, body, headers)
     * @returns {Promise<object>} - parsed JSON response
     *
     * Usage:
     *   const data = await zoiApi('/orders');
     *   const result = await zoiApi('/auth/login', { method: 'POST', body: JSON.stringify({...}) });
     */
    async function zoiApi(path, options = {}) {
        const url = ZOI_CONFIG.API_BASE_URL + path;
        const token = ZoiToken.get();

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData (file uploads)
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle 401 — token expired
            if (response.status === 401) {
                ZoiToken.remove();
                // Don't redirect on login attempts
                if (!path.includes('/auth/')) {
                    console.warn('[ZOI] Auth expired. Redirecting to login...');
                    // Give toast a chance to show
                    if (typeof showToast === 'function') {
                        showToast('Session expired. Please login again.', 'warning');
                    }
                }
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            if (error.status) throw error; // Already formatted error
            // Network error — backend is down
            console.warn(`[ZOI] API call failed (${path}):`, error.message || error);
            throw { status: 0, error: 'Network error. Backend might be offline.' };
        }
    }

    /**
     * API wrapper that silently falls back to null on failure.
     * Use for non-critical data fetching where localStorage fallback exists.
     */
    async function zoiApiSilent(path, options = {}) {
        try {
            return await zoiApi(path, options);
        } catch (e) {
            console.warn(`[ZOI] Silent API fallback for ${path}`);
            return null;
        }
    }

    // ─── SOCKET HELPER ──────────────────────────────────
    let _zoiSocket = null;

    function getZoiSocket() {
        if (_zoiSocket) return _zoiSocket;
        if (typeof io === 'undefined') return null;

        try {
            _zoiSocket = io(ZOI_CONFIG.SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000
            });

            _zoiSocket.on('connect', () => {
                console.log('🟢 Z.O.I. WebSocket connected');
            });

            _zoiSocket.on('disconnect', () => {
                console.log('🔴 Z.O.I. WebSocket disconnected');
            });

            return _zoiSocket;
        } catch (e) {
            console.warn('[ZOI] Socket connection failed:', e.message);
            return null;
        }
    }

    // ─── EXPOSE GLOBALLY ────────────────────────────────
    window.ZOI_CONFIG = ZOI_CONFIG;
    window.ZoiToken = ZoiToken;
    window.zoiApi = zoiApi;
    window.zoiApiSilent = zoiApiSilent;
    window.getZoiSocket = getZoiSocket;

    // ─── DEMO MODE BANNER ──────────────────────────────
    if (ZOI_CONFIG.DEMO_MODE) {
        console.log(
            '%c 🧪 ZipZapZoi Eats — DEMO MODE %c v' + ZOI_CONFIG.APP_VERSION + ' ',
            'background: #f27f0d; color: #000; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
            'background: #2a2d35; color: #f27f0d; padding: 4px 8px; border-radius: 0 4px 4px 0;'
        );
        console.warn('[ZOI] Running in DEMO mode. API calls use simulated data. Set ZOI_CONFIG.DEMO_MODE = false for production.');
    }

})();
