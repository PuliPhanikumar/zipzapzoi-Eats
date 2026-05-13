/**
 * ZipZapZoi — Shared Socket.io Client (zoi_socket.js)
 * =====================================================
 * Provides a unified real-time connection layer across all pages.
 * Auto-reconnects, joins rooms, and falls back to polling if
 * Socket.io is unavailable (CDN blocked / backend down).
 *
 * Usage:
 *   ZoiSocket.connect();
 *   ZoiSocket.on('new_order', (order) => { ... });
 *   ZoiSocket.joinRoom('restaurant_1');
 *   ZoiSocket.emit('join_room', 'restaurant_1');
 *
 * Events emitted by backend:
 *   new_order          — { id, zoiId, total, items, status, tableId }
 *   order_status_update— { id, zoiId, status, ... }
 *   table_update       — { id, tableNumber, status, ... }
 *   rider_location     — { riderId, lat, lng, orderId }
 *   chat_message       — { user, message, timestamp }
 */

const ZoiSocket = (() => {
    const API_BASE = (typeof ZOI_CONFIG !== 'undefined' && ZOI_CONFIG.API_BASE_URL)
        ? ZOI_CONFIG.API_BASE_URL
        : (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

    let _socket = null;
    let _connected = false;
    let _listeners = {};       // { eventName: [callbacks] }
    let _rooms = [];           // rooms to auto-rejoin on reconnect
    let _fallbackTimers = {};  // { eventName: intervalId } for polling fallback
    let _connectAttempted = false;

    // ── Attempt Socket.io CDN load then connect ──────────────────────
    function _loadSocketIO(cb) {
        if (typeof io !== 'undefined') { cb(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
        script.onload = cb;
        script.onerror = () => {
            console.warn('[ZoiSocket] socket.io CDN failed — real-time unavailable, using polling.');
        };
        document.head.appendChild(script);
    }

    function connect() {
        if (_connectAttempted) return;
        _connectAttempted = true;

        _loadSocketIO(() => {
            if (typeof io === 'undefined') { _onFallback(); return; }

            try {
                _socket = io(API_BASE, {
                    transports: ['websocket', 'polling'],
                    reconnectionAttempts: 8,
                    reconnectionDelay: 1500,
                    timeout: 5000
                });

                _socket.on('connect', () => {
                    _connected = true;
                    console.log('[ZoiSocket] ✅ Connected:', _socket.id);
                    // Rejoin all rooms after reconnect
                    _rooms.forEach(room => _socket.emit('join_room', room));
                    _showStatusBadge(true);
                });

                _socket.on('disconnect', (reason) => {
                    _connected = false;
                    console.warn('[ZoiSocket] Disconnected:', reason);
                    _showStatusBadge(false);
                });

                _socket.on('connect_error', (err) => {
                    console.warn('[ZoiSocket] Connection error:', err.message);
                    _onFallback();
                });

                // Forward all registered events from backend to local listeners
                const BACKEND_EVENTS = [
                    'new_order', 'order_status_update', 'table_update',
                    'rider_location', 'chat_message', 'kds_update',
                    'badge_awarded', 'referral_completed'
                ];
                BACKEND_EVENTS.forEach(event => {
                    _socket.on(event, (data) => {
                        (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} });
                    });
                });

            } catch (e) {
                console.error('[ZoiSocket] Init error:', e);
                _onFallback();
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────
    function on(event, callback) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(callback);
        // If socket is already connected, bind immediately
        if (_socket && _connected) {
            _socket.on(event, callback);
        }
    }

    function off(event, callback) {
        if (_listeners[event]) {
            _listeners[event] = _listeners[event].filter(cb => cb !== callback);
        }
        if (_socket) _socket.off(event, callback);
    }

    function emit(event, data) {
        if (_socket && _connected) {
            _socket.emit(event, data);
        }
    }

    function joinRoom(room) {
        if (!_rooms.includes(room)) _rooms.push(room);
        if (_socket && _connected) {
            _socket.emit('join_room', room);
            console.log('[ZoiSocket] Joined room:', room);
        }
    }

    function isConnected() { return _connected; }

    // ── Polling Fallback ──────────────────────────────────────────────
    // When WebSocket is unavailable, pages can register a polling fallback
    // ZoiSocket.withFallback('new_order', fetchFn, 8000)
    function withFallback(event, fetchFn, intervalMs) {
        // If WebSocket is working, just use it — no need to poll
        if (_connected) return;
        // Start polling as fallback
        if (!_fallbackTimers[event]) {
            console.log(`[ZoiSocket] Fallback polling for '${event}' every ${intervalMs}ms`);
            fetchFn(); // immediate first call
            _fallbackTimers[event] = setInterval(fetchFn, intervalMs);
        }
        // Stop fallback timer once WebSocket connects
        on('connect', () => {
            if (_fallbackTimers[event]) {
                clearInterval(_fallbackTimers[event]);
                delete _fallbackTimers[event];
                console.log(`[ZoiSocket] Stopped fallback polling for '${event}'`);
            }
        });
    }

    // ── Live Status Badge (shown in corner of real-time pages) ────────
    function _showStatusBadge(online) {
        let badge = document.getElementById('zoi-ws-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'zoi-ws-badge';
            badge.style.cssText = `
                position:fixed;bottom:72px;right:16px;z-index:9999;
                display:flex;align-items:center;gap:6px;
                padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;
                backdrop-filter:blur(8px);border:1px solid;
                transition:all 0.3s ease;pointer-events:none;
                font-family:inherit;
            `;
            document.body.appendChild(badge);
        }
        if (online) {
            badge.style.background = 'rgba(34,197,94,0.15)';
            badge.style.borderColor = 'rgba(34,197,94,0.4)';
            badge.style.color = '#22c55e';
            badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 2s infinite"></span> Live';
        } else {
            badge.style.background = 'rgba(239,68,68,0.15)';
            badge.style.borderColor = 'rgba(239,68,68,0.4)';
            badge.style.color = '#ef4444';
            badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block"></span> Reconnecting...';
        }
    }

    // ── Inject pulse animation ────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = '@keyframes zoiPulse{0%,100%{opacity:1}50%{opacity:.4}}#zoi-ws-badge span{animation:zoiPulse 2s infinite}';
    document.head.appendChild(style);

    return { connect, on, off, emit, joinRoom, isConnected, withFallback };
})();

// Auto-connect on script load
document.addEventListener('DOMContentLoaded', () => ZoiSocket.connect());
