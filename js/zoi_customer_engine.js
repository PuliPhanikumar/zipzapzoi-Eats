/**
 * ZipZapZoi Eats — Customer Engine (The Glue)
 * =============================================
 * Shared logic module for ALL customer pages.
 * Provides: Cart state, User state, Toasts, Profile CRUD,
 * Feedback, Referrals, Coupons, Support Tickets, Reviews.
 *
 * Usage: <script src="js/zoi_customer_engine.js"></script>
 * Must load AFTER db_simulation.js if present.
 */
(function () {
    'use strict';

    // ─── TOAST NOTIFICATION SYSTEM ──────────────────────────
    const TOAST_STYLES = `
    #zoi-toast-container {
        position: fixed; top: 20px; right: 20px; z-index: 99999;
        display: flex; flex-direction: column; gap: 10px;
        pointer-events: none; max-width: 380px;
    }
    .zoi-toast {
        pointer-events: auto; display: flex; align-items: center; gap: 12px;
        padding: 14px 20px; border-radius: 14px; min-width: 280px;
        font-family: 'Manrope','Plus Jakarta Sans',sans-serif;
        font-size: 13px; font-weight: 600; color: #fff;
        backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1);
        animation: zoi-toast-in 0.4s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .zoi-toast.success { background: linear-gradient(135deg, rgba(16,185,129,0.9), rgba(5,150,105,0.9)); }
    .zoi-toast.error { background: linear-gradient(135deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9)); }
    .zoi-toast.info { background: linear-gradient(135deg, rgba(0,240,255,0.15), rgba(124,58,237,0.15)); border-color: rgba(0,240,255,0.3); }
    .zoi-toast.warning { background: linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9)); }
    .zoi-toast-icon { font-size: 20px; flex-shrink: 0; }
    .zoi-toast-close { margin-left: auto; cursor: pointer; opacity: 0.7; font-size: 16px; }
    .zoi-toast-close:hover { opacity: 1; }
    @keyframes zoi-toast-in { from { opacity:0; transform:translateX(60px); } to { opacity:1; transform:translateX(0); } }
    @keyframes zoi-toast-out { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(60px); } }
    `;

    function showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('zoi-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'zoi-toast-container';
            document.body.appendChild(container);
        }
        const icons = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
        const toast = document.createElement('div');
        toast.className = `zoi-toast ${type}`;
        toast.innerHTML = `<span class="zoi-toast-icon">${icons[type] || '💡'}</span><span>${message}</span><span class="zoi-toast-close" onclick="this.parentElement.remove()">✕</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'zoi-toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ─── CART STATE MODULE ──────────────────────────────────
    const ZoiCart = {
        KEY: 'zoiCart',
        get: () => JSON.parse(localStorage.getItem('zoiCart')) || [],
        save: (cart) => {
            localStorage.setItem('zoiCart', JSON.stringify(cart));
            ZoiCart.updateBadges();
            window.dispatchEvent(new Event('zoiCartUpdated'));
        },
        add: (item, qty = 1) => {
            const cart = ZoiCart.get();
            const existing = cart.find(c => c.id === item.id && c.restId === item.restId);
            if (existing) {
                existing.qty += qty;
            } else {
                cart.push({ ...item, qty });
            }
            ZoiCart.save(cart);
            showToast(`${item.name} added to cart!`, 'success');
            return cart;
        },
        remove: (itemId, restId) => {
            let cart = ZoiCart.get();
            cart = cart.filter(c => !(c.id === itemId && c.restId === restId));
            ZoiCart.save(cart);
            return cart;
        },
        updateQty: (itemId, restId, qty) => {
            const cart = ZoiCart.get();
            const item = cart.find(c => c.id === itemId && c.restId === restId);
            if (item) {
                item.qty = Math.max(0, qty);
                if (item.qty === 0) return ZoiCart.remove(itemId, restId);
            }
            ZoiCart.save(cart);
            return cart;
        },
        clear: () => { ZoiCart.save([]); },
        getTotal: () => {
            return ZoiCart.get().reduce((sum, item) => sum + (item.price * item.qty), 0);
        },
        getCount: () => {
            return ZoiCart.get().reduce((sum, item) => sum + item.qty, 0);
        },
        updateBadges: () => {
            const count = ZoiCart.getCount();
            document.querySelectorAll('[data-zoi-cart-count], .zoi-cart-badge').forEach(el => {
                el.textContent = count;
                el.style.display = count > 0 ? 'flex' : 'none';
            });
            // Also try common selectors for cart badges
            document.querySelectorAll('.cart-count, .cart-badge, [id*="cart-count"], [id*="cartCount"]').forEach(el => {
                if (el.tagName !== 'A') {
                    el.textContent = count;
                    el.style.display = count > 0 ? '' : 'none';
                }
            });
        }
    };

    // ─── USER STATE MODULE ──────────────────────────────────
    const ZoiCustomer = {
        KEY: 'zoiCustomerSession',
        getSession: () => {
            // Priority 1: Try decoding the JWT token for fresh user data
            try {
                if (typeof ZoiToken !== 'undefined' && ZoiToken.isValid()) {
                    const user = ZoiToken.getUser();
                    if (user && user.name) return user;
                }
            } catch (e) { /* Token decode failed, fall through to localStorage */ }

            // Priority 2: Local session from login page (zoiCustomerSession)
            try {
                const localSess = JSON.parse(localStorage.getItem('zoiCustomerSession'));
                if (localSess && localSess.name) return localSess;
            } catch (e) { /* corrupt JSON, fall through */ }

            // Priority 3: Legacy zoiUser key (older login flow saved here)
            try {
                const legacyUser = JSON.parse(localStorage.getItem('zoiUser'));
                if (legacyUser && legacyUser.name && legacyUser.name !== 'New User') {
                    // Sync to zoiCustomerSession for future reads
                    localStorage.setItem('zoiCustomerSession', JSON.stringify(legacyUser));
                    return legacyUser;
                }
            } catch (e) { /* corrupt JSON, fall through */ }

            // IMPORTANT: We NEVER delete any session data here.
            // Only ZoiCustomer.logout() has permission to clear auth state.
            return null;
        },
        isLoggedIn: () => !!ZoiCustomer.getSession(),
        login: (userData) => {
            const session = {
                id: userData.id || 'CUST-' + Math.floor(1000 + Math.random() * 9000),
                name: userData.name || 'Guest',
                email: userData.email || '',
                phone: userData.phone || '',
                avatar: userData.avatar || '',
                loginTime: new Date().toISOString(),
                ...userData
            };
            localStorage.setItem('zoiCustomerSession', JSON.stringify(session));
            ZoiCustomer.updateUI();
            return session;
        },
        logout: () => {
            localStorage.removeItem('zoiCustomerSession');
            localStorage.removeItem('zoiUserProfile');
            localStorage.removeItem('zoiCart');
            localStorage.removeItem('zoiAppliedCoupon');
            if (typeof ZoiToken !== 'undefined') ZoiToken.remove();

            // Purge legacy zoiUser unconditionally to prevent ghost logins
            localStorage.removeItem('zoiUser');
            
            // Purge other session markers just to be safe
            localStorage.removeItem('zoiAuthToken');
            localStorage.removeItem('zoiToken');
            
            // Optional: Also clear registered users list for testing if needed
            // localStorage.removeItem('zoiRegisteredUsers');

            
            // Only show toast and redirect if NOT already on the login page
            const onLoginPage = window.location.pathname.toLowerCase().includes('login');
            if (!onLoginPage) {
                showToast('Logged out successfully', 'info');
                setTimeout(() => window.location.href = 'login & registration.html', 800);
            }
        },
        updateUI: () => {
            let session = ZoiCustomer.getSession();
            // Fallback: check zoiUser (login page saves here)
            if (!session) {
                try {
                    const loginUser = JSON.parse(localStorage.getItem('zoiUser') || 'null');
                    if (loginUser && loginUser.name && loginUser.name !== 'New User') {
                        session = loginUser;
                        // Sync to customer session for future use
                        localStorage.setItem('zoiCustomerSession', JSON.stringify({
                            id: loginUser.id || 'CUST-' + Math.floor(1000 + Math.random() * 9000),
                            name: loginUser.name,
                            email: loginUser.email || '',
                            phone: loginUser.phone || '',
                            type: loginUser.type || 'customer',
                            loginTime: new Date().toISOString()
                        }));
                    }
                } catch (e) {}
            }

            if (session) {
                // 1. Update all items that look like Sign In / Login
                if (!window.location.pathname.toLowerCase().includes('login')) {
                    document.querySelectorAll('a, button').forEach(el => {
                        const text = el.textContent.trim().toLowerCase();
                        if (text === 'sign in' || text === 'login' || text === 'log in' || text === 'sign up' || text === 'register') {
                            // If it's a link or button, change it to show user name
                            el.textContent = session.name.split(' ')[0];
                            if (el.tagName === 'A') el.href = 'customer profile.html';
                            else el.onclick = () => window.location.href = 'customer profile.html';
                            
                            el.classList.add('zoi-user-active');
                        }
                    });
                }

                // 2. Specific header IDs (found in index.html, shopping_cart.html, etc)
                const nameEls = document.querySelectorAll('#header-user-name, #user-avatar-text, #profile-name');
                nameEls.forEach(el => el.textContent = session.name);

                const avatarEls = document.querySelectorAll('#header-user-avatar, #user-avatar-initial, [id*="avatar"]');
                avatarEls.forEach(el => {
                    if (el.children.length === 0 || el.querySelector('.material-symbols-outlined')) {
                        const initial = session.name.charAt(0).toUpperCase();
                        if (el.querySelector('.material-symbols-outlined')) {
                            el.querySelector('.material-symbols-outlined').textContent = ''; // Clear icon text
                            el.querySelector('.material-symbols-outlined').textContent = initial;
                        } else {
                            el.textContent = initial;
                        }
                    }
                });

                // 3. Update avatar containers (generic search)
                document.querySelectorAll('[id*="avatar"], [class*="avatar"], [id*="profile"], #header-profile-link').forEach(el => {
                    const icon = el.querySelector('.material-symbols-outlined');
                    if (icon && (icon.textContent === 'person' || icon.textContent === 'account_circle')) {
                        icon.textContent = session.name.charAt(0).toUpperCase();
                        icon.classList.remove('material-symbols-outlined');
                        icon.classList.add('font-bold', 'text-primary');
                    }
                });
                
                // 4. Sidebar Highlight Sync
                function syncSidebarHighlight() {
                    const links = document.querySelectorAll('aside a[href]');
                    if (!links.length) return;
                    
                    const currentPath = window.location.pathname.toLowerCase();
                    const currentHash = window.location.hash.toLowerCase();
                    
                    links.forEach(link => {
                        const href = link.getAttribute('href').toLowerCase();
                        
                        // Default state (inactive format)
                        link.className = 'sidebar-nav-link flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-border-dark/50 transition-colors group text-text-muted hover:text-white';
                        
                        // Check if active
                        let isActive = false;
                        if (href.startsWith('#')) {
                            if (currentHash === href) isActive = true;
                        } else {
                            if (currentPath.includes(href)) isActive = true;
                            // Special case: if we are on profile.html and there's a hash, the overview tab shouldn't be active if it points to just 'customer profile.html'
                            if (currentPath.includes('customer profile.html') && href === 'customer profile.html' && currentHash) {
                                isActive = false;
                            }
                        }
                        
                        // Special fallback for profile page with no hash (Overview is active)
                        if (currentPath.includes('customer profile.html') && !currentHash && href === 'customer profile.html') {
                            isActive = true;
                        }
                        
                        if (isActive) {
                            link.className = 'sidebar-nav-link flex items-center gap-3 px-3 py-3 rounded-lg bg-primary text-background-dark shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-colors group';
                        }
                    });
                }
                
                syncSidebarHighlight();
                window.addEventListener('hashchange', syncSidebarHighlight);
            }

            // Update all elements with specific data attributes
            document.querySelectorAll('[data-zoi-user-name]').forEach(el => {
                el.textContent = session ? session.name : 'Guest';
            });
        },
        guard: () => {
            const path = window.location.pathname.toLowerCase();
            const protectedPages = [
                'customer profile.html',
                'customer order_tracking.html',
                'customer order_history.html',
                'customer wallet.html',
                'customer address_book.html'
            ];
            
            if (protectedPages.some(p => path.includes(p.toLowerCase()))) {
                if (!ZoiCustomer.isLoggedIn()) {
                    showToast('Please login to access this page', 'warning');
                    setTimeout(() => window.location.href = 'login & registration.html', 1500);
                }
            }
        }
    };

    // ─── PROFILE CRUD MODULE ────────────────────────────────
    const ZoiProfile = {
        KEY: 'zoiUserProfile',
        get: () => JSON.parse(localStorage.getItem('zoiUserProfile')) || {
            name: '', email: '', phone: '',
            addresses: [],
            payments: [],
            dietary: { veg: false, vegan: false, glutenFree: false, lactoseFree: false },
            notifications: { orders: true, promos: true, social: false, sms: true },
            points: 0,
            memberSince: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            totalOrders: 0,
            savedAmount: '₹0'
        },
        save: (profile) => {
            localStorage.setItem('zoiUserProfile', JSON.stringify(profile));
            showToast('Profile updated!', 'success');
        },
        getDeterministicStats: (zoiId) => {
            if (!zoiId) return { wallet: 0, points: 0 };
            let hash = 0;
            for (let i = 0; i < zoiId.length; i++) {
                hash = zoiId.charCodeAt(i) + ((hash << 5) - hash);
            }
            const baseWallet = Math.abs(hash % 5000) + 150.50; 
            const basePoints = Math.abs(hash % 5000) + 200;
            const overrides = JSON.parse(localStorage.getItem('zoiStatsOverride_' + zoiId) || '{}');
            return {
                wallet: overrides.wallet !== undefined ? overrides.wallet : baseWallet,
                points: overrides.points !== undefined ? overrides.points : basePoints
            };
        },
        updateDeterministicStats: (zoiId, type, change) => {
            if (!zoiId) return;
            const current = ZoiProfile.getDeterministicStats(zoiId);
            const overrides = JSON.parse(localStorage.getItem('zoiStatsOverride_' + zoiId) || '{}');
            if (type === 'points') overrides.points = Math.max(0, current.points + change);
            if (type === 'wallet') overrides.wallet = Math.max(0, current.wallet + change);
            localStorage.setItem('zoiStatsOverride_' + zoiId, JSON.stringify(overrides));
            return type === 'points' ? overrides.points : overrides.wallet;
        },
        updateField: (field, value) => {
            const p = ZoiProfile.get();
            p[field] = value;
            ZoiProfile.save(p);
        },
        addAddress: (address) => {
            const p = ZoiProfile.get();
            address.id = Date.now();
            p.addresses.push(address);
            ZoiProfile.save(p);
        },
        removeAddress: (id) => {
            const p = ZoiProfile.get();
            p.addresses = p.addresses.filter(a => a.id !== id);
            ZoiProfile.save(p);
        },
        addPayment: (payment) => {
            const p = ZoiProfile.get();
            payment.id = Date.now();
            p.payments.push(payment);
            ZoiProfile.save(p);
        }
    };

    // ─── FEEDBACK MODULE ────────────────────────────────────
    const ZoiFeedback = {
        KEY: 'zoiFeedbackEntries',
        getAll: () => JSON.parse(localStorage.getItem('zoiFeedbackEntries')) || [],
        submit: (data) => {
            const entries = ZoiFeedback.getAll();
            const entry = {
                id: 'FB-' + Math.floor(1000 + Math.random() * 9000),
                rating: data.rating || 5,
                category: data.category || 'General',
                subject: data.subject || '',
                message: data.message || '',
                name: data.name || ZoiProfile.get().name,
                email: data.email || ZoiProfile.get().email,
                date: new Date().toISOString(),
                status: 'Open',
                priority: data.priority || 'Medium'
            };
            entries.unshift(entry);
            localStorage.setItem('zoiFeedbackEntries', JSON.stringify(entries));

            // ADMIN SYNC: write to shared admin key
            const adminFB = JSON.parse(localStorage.getItem('zoiFeedback') || '[]');
            adminFB.unshift({
                id: entry.id, user: entry.name, email: entry.email,
                type: entry.category, subject: entry.subject,
                message: entry.message, status: 'Open',
                priority: entry.priority, date: entry.date,
                assignedTo: 'Unassigned', responses: []
            });
            localStorage.setItem('zoiFeedback', JSON.stringify(adminFB));

            showToast('Feedback submitted! Thank you 🙏', 'success');
            return entry;
        }
    };

    // ─── REFERRAL MODULE ────────────────────────────────────
    const ZoiReferral = {
        KEY: 'zoiReferralData',
        getData: () => JSON.parse(localStorage.getItem('zoiReferralData')) || {
            code: 'ZOIEATS' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            referrals: [],
            earned: 0,
            pending: 0
        },
        save: (data) => localStorage.setItem('zoiReferralData', JSON.stringify(data)),
        copyCode: () => {
            const data = ZoiReferral.getData();
            if (navigator.clipboard) {
                navigator.clipboard.writeText(data.code).then(() => {
                    showToast(`Referral code "${data.code}" copied!`, 'success');
                });
            } else {
                // Fallback
                const input = document.createElement('input');
                input.value = data.code;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showToast(`Referral code "${data.code}" copied!`, 'success');
            }
        },
        shareWhatsApp: () => {
            const data = ZoiReferral.getData();
            const msg = encodeURIComponent(`🍕 Get ₹200 off your first ZipZapZoi Eats order! Use my referral code: ${data.code}\n\nDownload now: https://zipzapzoi.com`);
            window.open(`https://wa.me/?text=${msg}`, '_blank');
        },
        shareGeneric: () => {
            const data = ZoiReferral.getData();
            if (navigator.share) {
                navigator.share({
                    title: 'ZipZapZoi Eats - Get ₹200 Off!',
                    text: `Use my referral code: ${data.code}`,
                    url: 'https://zipzapzoi.com'
                });
            } else {
                ZoiReferral.copyCode();
            }
        }
    };

    // ─── COUPON / PROMO MODULE ──────────────────────────────
    const ZoiCoupon = {
        copy: (code) => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(code).then(() => {
                    showToast(`Coupon "${code}" copied to clipboard!`, 'success');
                });
            } else {
                const input = document.createElement('input');
                input.value = code;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showToast(`Coupon "${code}" copied!`, 'success');
            }
        },
        apply: (code) => {
            // Check against stored promos
            let promos = [];
            try { promos = typeof ZoiPromos !== 'undefined' ? ZoiPromos.getAll() : []; } catch (e) { }
            const promo = promos.find(p => p.code === code && p.status === 'Active');
            if (promo) {
                localStorage.setItem('zoiAppliedCoupon', JSON.stringify(promo));
                showToast(`🎉 Coupon "${code}" applied! ${promo.type === '%' ? promo.val + '% off' : '₹' + promo.val + ' off'}`, 'success');
                return promo;
            }
            showToast(`Invalid or expired coupon code`, 'error');
            return null;
        },
        getApplied: () => JSON.parse(localStorage.getItem('zoiAppliedCoupon')) || null,
        remove: () => {
            localStorage.removeItem('zoiAppliedCoupon');
            showToast('Coupon removed', 'info');
        }
    };

    // ─── SUPPORT TICKET MODULE ──────────────────────────────
    const ZoiSupport = {
        KEY: 'zoiSupportTickets',
        getAll: () => JSON.parse(localStorage.getItem('zoiSupportTickets')) || [],
        submit: (data) => {
            const tickets = ZoiSupport.getAll();
            const ticket = {
                id: 'TKT-' + Math.floor(10000 + Math.random() * 90000),
                subject: data.subject || 'General Inquiry',
                category: data.category || 'Other',
                message: data.message || '',
                name: data.name || ZoiProfile.get().name,
                email: data.email || ZoiProfile.get().email,
                date: new Date().toISOString(),
                status: 'Open',
                priority: data.priority || 'Medium'
            };
            tickets.unshift(ticket);
            localStorage.setItem('zoiSupportTickets', JSON.stringify(tickets));

            // ADMIN SYNC: write to zoiDisputes (admin dispute resolution reads this)
            try {
                const disputes = JSON.parse(localStorage.getItem('zoiDisputes') || '[]');
                disputes.unshift({
                    id: ticket.id, orderId: 'N/A', type: 'Support Ticket',
                    customer: ticket.name, description: ticket.subject + ': ' + ticket.message,
                    status: 'Open', priority: ticket.priority,
                    date: ticket.date, log: [{ action: 'Ticket created by customer', date: ticket.date }]
                });
                localStorage.setItem('zoiDisputes', JSON.stringify(disputes));
            } catch (e) { }

            showToast(`Ticket ${ticket.id} created! We'll respond within 24h.`, 'success');
            return ticket;
        }
    };

    // ─── REVIEW MODULE ──────────────────────────────────────
    const ZoiReviews = {
        KEY: 'zoiReviews',
        getAll: (restId) => {
            const all = JSON.parse(localStorage.getItem('zoiReviews')) || {};
            return restId ? (all[restId] || []) : all;
        },
        submit: (restId, data) => {
            const all = JSON.parse(localStorage.getItem('zoiReviews')) || {};
            if (!all[restId]) all[restId] = [];
            const review = {
                id: 'REV-' + Date.now(),
                rating: data.rating || 5,
                title: data.title || '',
                text: data.text || '',
                author: data.author || ZoiProfile.get().name,
                date: new Date().toISOString(),
                helpful: 0,
                photos: data.photos || []
            };
            all[restId].unshift(review);
            localStorage.setItem('zoiReviews', JSON.stringify(all));
            showToast('Review posted! Thanks for sharing 🌟', 'success');

            // Award gamification points
            try {
                const profile = ZoiProfile.get();
                profile.points = (profile.points || 0) + 50;
                ZoiProfile.save(profile);
            } catch (e) { }
            return review;
        }
    };

    // ─── ORDER HISTORY MODULE ───────────────────────────────
    const ZoiOrderHistory = {
        KEY: 'zoiOrderHistory',
        getAll: () => JSON.parse(localStorage.getItem('zoiOrderHistory')) || [],
        add: (order) => {
            const history = ZoiOrderHistory.getAll();
            const entry = {
                id: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
                restaurant: order.restaurant || 'Restaurant',
                restId: order.restId || '',
                items: order.items || [],
                total: order.total || 0,
                date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                status: 'Preparing',
                payment: order.payment || 'UPI',
                address: order.address || ZoiProfile.get().addresses[0]?.address || '',
                image: order.image || ''
            };
            history.unshift(entry);
            localStorage.setItem('zoiOrderHistory', JSON.stringify(history));

            // ADMIN SYNC: write to zoiCompletedOrders (admin dashboard reads this)
            try {
                const adminOrders = JSON.parse(localStorage.getItem('zoiCompletedOrders') || '[]');
                adminOrders.unshift({
                    id: entry.id, customer: ZoiProfile.get().name,
                    restaurant: entry.restaurant, items: entry.items,
                    total: entry.total, status: entry.status,
                    date: entry.date, time: entry.time,
                    payment: entry.payment, address: entry.address
                });
                localStorage.setItem('zoiCompletedOrders', JSON.stringify(adminOrders));
            } catch (e) { }

            // Award gamification points
            try {
                const profile = ZoiProfile.get();
                profile.points = (profile.points || 0) + 10;
                profile.totalOrders = (profile.totalOrders || 0) + 1;
                localStorage.setItem('zoiUserProfile', JSON.stringify(profile));
            } catch (e) { }

            return entry;
        }
    };

    // ─── LOYALTY MODULE ─────────────────────────────────────
    const ZoiLoyalty = {
        KEY: 'zoiLoyaltyPrograms',
        getJoined: () => JSON.parse(localStorage.getItem('zoiLoyaltyPrograms')) || [],
        join: (programName) => {
            const joined = ZoiLoyalty.getJoined();
            if (joined.find(p => p.name === programName)) {
                showToast(`You are already a member of ${programName}!`, 'info');
                return;
            }
            joined.push({ 
                id: 'PROG-' + Date.now(),
                name: programName, 
                joinedDate: new Date().toISOString(),
                points: 0
            });
            localStorage.setItem('zoiLoyaltyPrograms', JSON.stringify(joined));
            showToast(`Welcome to ${programName}! 🎊 Reward points are now active.`, 'success');
            
            // Re-wire to update UI if needed
            ZoiCustomer.updateUI();
        },
        redeem: (programName, rewardName) => {
            showToast(`🎉 Reward Redeemed! Your ${rewardName} is now available in your active coupons.`, 'success', 5000);
            // Simulate adding a coupon
            ZoiCoupon.apply('LOYALTY-FREE');
        },
        leave: (programId) => {
            let joined = ZoiLoyalty.getJoined();
            joined = joined.filter(p => p.id !== programId);
            localStorage.setItem('zoiLoyaltyPrograms', JSON.stringify(joined));
            showToast('Left the loyalty program', 'info');
        }
    };

    // ─── SUBSCRIPTION MODULE ────────────────────────────────
    const ZoiSubscription = {
        KEY: 'zoiSubscription',
        get: () => JSON.parse(localStorage.getItem('zoiSubscription')) || null,
        subscribe: (plan) => {
            const sub = {
                plan: plan.name || plan,
                price: plan.price || 0,
                startDate: new Date().toISOString(),
                status: 'Active',
                autoRenew: true
            };
            localStorage.setItem('zoiSubscription', JSON.stringify(sub));

            // ADMIN SYNC: write to zoiSubs (admin subscription mgmt reads this)
            try {
                const adminSubs = JSON.parse(localStorage.getItem('zoiSubs') || '[]');
                adminSubs.unshift({
                    id: 'SUB-' + Date.now(),
                    customer: ZoiProfile.get().name,
                    email: ZoiProfile.get().email,
                    plan: sub.plan, price: sub.price,
                    startDate: sub.startDate, status: 'Active',
                    autoRenew: true
                });
                localStorage.setItem('zoiSubs', JSON.stringify(adminSubs));
            } catch (e) { }

            showToast(`🎉 Welcome to ${sub.plan}! Your benefits are now active.`, 'success');
            return sub;
        },
        cancel: () => {
            const sub = ZoiSubscription.get();
            if (sub) {
                sub.status = 'Cancelled';
                localStorage.setItem('zoiSubscription', JSON.stringify(sub));
                showToast('Subscription cancelled. Benefits until period ends.', 'info');
            }
        }
    };

    // ─── PAGE-SPECIFIC AUTO-WIRING ──────────────────────────
    function wireCurrentPage() {
        const path = window.location.pathname.toLowerCase().replace(/\\/g, '/');
        const page = path.split('/').pop() || '';

        // Don't wire admin/partner/POS pages
        if (page.includes('admin') || page.includes('partner') || page.includes('pos-') ||
            page.includes('hostel') || page.includes('rider') || page.includes('restaurant_management') ||
            page.includes('restaurant_settings') || page.includes('restaurant_staff') ||
            page.includes('restaurant_financials') || page.includes('restaurant_menu_manager') ||
            page.includes('restaurant_order')) return;

        // === PROFILE PAGE ===
        if (page.includes('customer profile') || page.includes('customer%20profile')) {
            wireProfilePage();
        }

        // === FEEDBACK PAGE ===
        // NOTE: feedback.html has its own dedicated inline script for form handling
        // with admin sync. Skip engine auto-wiring to avoid double-handler conflicts.
        // if (page.includes('feedback')) { wireFeedbackPage(); }

        // === REFERRAL PAGE ===
        if (page.includes('referral')) {
            wireReferralPage();
        }

        // === SUPPORT PAGE ===
        if (page.includes('index.html')) wireIndexPage();
        if (page.includes('customer_loyalty_programs.html')) wireLoyaltyPage();
        if (page.includes('customer_support')) wireSupportPage();

        // === PROMOTIONS PAGE ===
        if (page.includes('promotions') || page.includes('offers')) {
            wirePromotionsPage();
        }

        // === REVIEWS PAGE ===
        if (page.includes('review')) {
            wireReviewsPage();
        }

        // === LOYALTY PAGE ===
        if (page.includes('loyality') || page.includes('loyalty')) {
            wireLoyaltyPage();
        }

        // === SUBSCRIPTION PAGE ===
        if (page.includes('subscription')) {
            wireSubscriptionPage();
        }

        // === INDEX PAGE ===
        if (page === 'index.html' || page === '' || page === '/') {
            wireIndexPage();
        }
    }

    // ─── WIRE: PROFILE PAGE ─────────────────────────────────
    function wireProfilePage() {
        const profile = ZoiProfile.get();

        // Fill profile fields with stored data
        const fieldMap = {
            'Full Name': profile.name, 'Display Name': profile.name,
            'Email': profile.email, 'Phone': profile.phone,
            'Date of Birth': profile.dob || ''
        };

        document.querySelectorAll('input').forEach(input => {
            const placeholder = (input.placeholder || '').trim();
            const label = input.previousElementSibling?.textContent?.trim() ||
                input.closest('div')?.querySelector('label, p, span')?.textContent?.trim() || '';

            for (const [key, val] of Object.entries(fieldMap)) {
                if (placeholder.toLowerCase().includes(key.toLowerCase()) ||
                    label.toLowerCase().includes(key.toLowerCase())) {
                    if (!input.value && val) input.value = val;
                }
            }
        });

        // Wire all buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            if (text.includes('save') || text.includes('update')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Collect all input values from the closest form/section
                    const section = btn.closest('section, form, div[class*="card"], div[class*="glass"]');
                    if (section) {
                        const inputs = section.querySelectorAll('input, select, textarea');
                        inputs.forEach(input => {
                            const label = input.previousElementSibling?.textContent?.trim() ||
                                input.closest('div')?.querySelector('label, p')?.textContent?.trim() || '';
                            if (label.toLowerCase().includes('name')) profile.name = input.value || profile.name;
                            if (label.toLowerCase().includes('email')) profile.email = input.value || profile.email;
                            if (label.toLowerCase().includes('phone')) profile.phone = input.value || profile.phone;
                        });
                    }
                    ZoiProfile.save(profile);
                });
            }

            if (text.includes('add address') || text.includes('new address')) {
                btn.addEventListener('click', () => {
                    const addr = prompt('Enter new address:');
                    if (addr) {
                        const label = prompt('Label (Home/Work/Other):') || 'Other';
                        ZoiProfile.addAddress({ label, address: addr, default: false });
                    }
                });
            }

            if (text.includes('add payment') || text.includes('add card') || text.includes('add upi')) {
                btn.addEventListener('click', () => {
                    const type = prompt('Payment type (UPI/Card):') || 'UPI';
                    const detail = prompt(`Enter ${type} detail:`) || '';
                    if (detail) ZoiProfile.addPayment({ type, detail, default: false });
                });
            }

            if (text.includes('logout') || text.includes('log out') || text.includes('sign out')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    ZoiCustomer.logout();
                });
            }

            if (text.includes('delete account')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                        localStorage.clear();
                        showToast('Account deleted', 'info');
                        setTimeout(() => window.location.href = 'index.html', 1500);
                    }
                });
            }

            if (text.includes('edit') && !btn._zoiWired) {
                btn._zoiWired = true;
                btn.addEventListener('click', () => {
                    const section = btn.closest('div[class*="card"], div[class*="glass"], section');
                    if (section) {
                        const inputs = section.querySelectorAll('input');
                        inputs.forEach(i => { i.disabled = false; i.focus(); });
                        showToast('Edit mode enabled', 'info');
                    }
                });
            }
        });

        // Wire toggle switches (notifications, dietary preferences)
        document.querySelectorAll('input[type="checkbox"], [role="switch"]').forEach(toggle => {
            toggle.addEventListener('change', () => {
                showToast('Preference saved!', 'success');
            });
        });
    }

    // ─── WIRE: FEEDBACK PAGE ────────────────────────────────
    function wireFeedbackPage() {
        let selectedRating = 5;

        // Wire star rating clicks
        document.querySelectorAll('[class*="star"], [data-rating], button[aria-label*="star"]').forEach((star, i) => {
            star.style.cursor = 'pointer';
            star.addEventListener('click', () => {
                selectedRating = i + 1;
                showToast(`Rating: ${'⭐'.repeat(selectedRating)}`, 'info', 1500);
            });
        });

        // Wire all submit/send buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes('submit') || text.includes('send') || text.includes('post')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const form = btn.closest('form, section, main');
                    const textarea = form?.querySelector('textarea');
                    const select = form?.querySelector('select');
                    const nameInput = form?.querySelector('input[type="text"], input[placeholder*="name" i]');
                    const emailInput = form?.querySelector('input[type="email"], input[placeholder*="email" i]');

                    ZoiFeedback.submit({
                        rating: selectedRating,
                        message: textarea?.value || '',
                        category: select?.value || 'General',
                        name: nameInput?.value || '',
                        email: emailInput?.value || ''
                    });

                    if (textarea) textarea.value = '';
                });
            }
        });
    }

    // ─── WIRE: REFERRAL PAGE ────────────────────────────────
    function wireReferralPage() {
        const data = ZoiReferral.getData();

        // Display referral code in any code display elements
        document.querySelectorAll('[class*="code"], [id*="code"], [class*="referral"], code, [class*="mono"]').forEach(el => {
            if (el.tagName !== 'A' && el.textContent.match(/^[A-Z0-9]{6,12}$|REFER|CODE/i)) {
                el.textContent = data.code;
            }
        });

        // Wire copy buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();
            const icon = btn.querySelector('.material-symbols-outlined')?.textContent || '';

            if (text.includes('copy') || icon.includes('content_copy') || icon.includes('copy')) {
                btn.addEventListener('click', (e) => { e.preventDefault(); ZoiReferral.copyCode(); });
            }
            if (text.includes('whatsapp') || icon.includes('whatsapp')) {
                btn.addEventListener('click', (e) => { e.preventDefault(); ZoiReferral.shareWhatsApp(); });
            }
            if (text.includes('share') || icon.includes('share')) {
                btn.addEventListener('click', (e) => { e.preventDefault(); ZoiReferral.shareGeneric(); });
            }
            if (text.includes('invite') || text.includes('refer')) {
                btn.addEventListener('click', (e) => { e.preventDefault(); ZoiReferral.shareGeneric(); });
            }
        });

        // Update stats displays
        document.querySelectorAll('[class*="stat"], [class*="count"]').forEach(el => {
            const text = el.textContent.trim();
            if (text === '0' || text === '--') {
                const label = el.closest('div')?.querySelector('p, span, label')?.textContent?.toLowerCase() || '';
                if (label.includes('earned')) el.textContent = '₹' + data.earned;
                if (label.includes('referral') && label.includes('count')) el.textContent = data.referrals.length;
            }
        });
    }

    // ─── WIRE: SUPPORT PAGE ─────────────────────────────────
    function wireSupportPage() {
        // Wire FAQ search
        document.querySelectorAll('input[type="search"], input[placeholder*="search" i], input[placeholder*="ask" i]').forEach(input => {
            input.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                document.querySelectorAll('details, [class*="faq"], [class*="accordion"]').forEach(faq => {
                    const text = faq.textContent.toLowerCase();
                    faq.style.display = !query || text.includes(query) ? '' : 'none';
                });
            });
        });

        // Wire contact/ticket buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes('submit') || text.includes('send') || text.includes('contact')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const form = btn.closest('form, section, div');
                    const inputs = form?.querySelectorAll('input, textarea, select') || [];
                    const data = {};
                    inputs.forEach(i => {
                        if (i.type === 'email') data.email = i.value;
                        else if (i.tagName === 'TEXTAREA') data.message = i.value;
                        else if (i.tagName === 'SELECT') data.category = i.value;
                        else data.subject = i.value;
                    });
                    if (data.message || data.subject) {
                        ZoiSupport.submit(data);
                        inputs.forEach(i => { if (i.tagName !== 'SELECT') i.value = ''; });
                    } else {
                        showToast('Please fill in the details', 'warning');
                    }
                });
            }

            if (text.includes('chat') || text.includes('live chat')) {
                btn.addEventListener('click', () => {
                    // Open the AI assistant if available
                    const fab = document.getElementById('zoi-ai-fab');
                    if (fab) fab.click();
                    else showToast('Live chat will be available soon!', 'info');
                });
            }

            if (text.includes('call') || text.includes('phone')) {
                btn.addEventListener('click', () => {
                    showToast('📞 Call us: 1800-ZOI-EATS (1800-964-3287)', 'info', 5000);
                });
            }
        });
    }

    // ─── WIRE: PROMOTIONS PAGE ──────────────────────────────
    function wirePromotionsPage() {
        // Wire any elements that look like coupon codes
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            if (text.includes('copy') || text.includes('claim') || text.includes('grab') || text.includes('use code')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const card = btn.closest('div[class*="card"], div[class*="glass"], article, div[class*="border"]');
                    if (card) {
                        // Find the code in the card
                        const codeEl = card.querySelector('[class*="code"], code, strong, [class*="mono"], [class*="font-bold"]');
                        const code = codeEl?.textContent?.trim() || '';
                        if (code && code.length <= 20 && /^[A-Z0-9]+$/.test(code)) {
                            ZoiCoupon.copy(code);
                        } else {
                            // Try to find any ALL CAPS text that looks like a code
                            const allText = card.textContent;
                            const codeMatch = allText.match(/\b([A-Z]{2,}[0-9]*)\b/);
                            if (codeMatch) ZoiCoupon.copy(codeMatch[1]);
                            else showToast('Offer applied to your next order!', 'success');
                        }
                    }
                });
            }

            if (text.includes('explore') || text.includes('order now') || text.includes('view')) {
                btn.addEventListener('click', () => {
                    window.location.href = 'customer_restaurant_listing.html';
                });
            }
        });
    }

    // ─── WIRE: REVIEWS PAGE ─────────────────────────────────
    function wireReviewsPage() {
        let selectedRating = 5;

        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            // Star rating
            if (btn.querySelector('.material-symbols-outlined')?.textContent?.includes('star')) {
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', () => {
                    selectedRating = parseInt(btn.dataset.rating || '5');
                    showToast(`Rating: ${'⭐'.repeat(selectedRating)}`, 'info', 1500);
                });
            }

            // Submit review
            if (text.includes('submit') || text.includes('post') || text.includes('publish')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const form = btn.closest('form, section, main');
                    const textarea = form?.querySelector('textarea');
                    const titleInput = form?.querySelector('input[type="text"]');

                    // Get restaurant ID from URL
                    const params = new URLSearchParams(window.location.search);
                    const restId = params.get('id') || '101';

                    ZoiReviews.submit(restId, {
                        rating: selectedRating,
                        title: titleInput?.value || '',
                        text: textarea?.value || ''
                    });

                    if (textarea) textarea.value = '';
                    if (titleInput) titleInput.value = '';
                });
            }

            // Helpful button
            if (text.includes('helpful') || text.includes('like') || text.includes('thumb')) {
                btn.addEventListener('click', () => {
                    showToast('Marked as helpful!', 'success');
                    const countEl = btn.querySelector('span:last-child') || btn;
                    const current = parseInt(countEl.textContent.match(/\d+/)?.[0] || '0');
                    countEl.textContent = countEl.textContent.replace(/\d+/, current + 1);
                });
            }
        });
    }

    // ─── WIRE: LOYALTY PAGE ─────────────────────────────────
    function wireLoyaltyPage() {
        // Wire join/leave buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            if (text.includes('join') || text.includes('enroll') || text.includes('sign up')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const card = btn.closest('div[class*="card"], div[class*="glass"], article');
                    const name = card?.querySelector('h2, h3, h4')?.textContent?.trim() || 'Loyalty Program';
                    ZoiLoyalty.join({ id: name.replace(/\s+/g, '-').toLowerCase(), name });
                    btn.textContent = 'Joined ✓';
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                });
            }

            if (text.includes('leave') || text.includes('cancel') || text.includes('unsubscribe')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const card = btn.closest('div[class*="card"], div[class*="glass"], article');
                    const name = card?.querySelector('h2, h3, h4')?.textContent?.trim() || '';
                    ZoiLoyalty.leave(name.replace(/\s+/g, '-').toLowerCase());
                });
            }
        });

        // Wire search/filter
        const searchInput = document.querySelector('input[placeholder*="Filter"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('section > div > div[class*="rounded"]').forEach(card => {
                    const text = card.textContent.toLowerCase();
                    if (text.includes(term)) {
                        card.style.display = 'flex';
                        if (card.classList.contains('grid')) card.style.display = 'grid';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // Stats updates (simulation)
        const savingsEl = document.querySelector('p[class*="Total Savings"] + p');
        if (savingsEl && ZoiProfile.isLoggedIn()) {
            const profile = ZoiProfile.get();
            if (profile.loyaltyPoints) {
                // Just a demo update
            }
        }

        // History button
        const historyBtn = document.querySelector('button:has(span:contains("History"))');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                showToast('Fetching your rewards history...', 'info');
            });
        }
    }

    // ─── WIRE: SUBSCRIPTION PAGE ────────────────────────────
    function wireSubscriptionPage() {
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            if (text.includes('get') || text.includes('join') || text.includes('subscribe') || text.includes('start') || text.includes('go ')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const card = btn.closest('div[class*="card"], div[class*="glass"], div[class*="rounded"]');
                    const planName = card?.querySelector('h3')?.textContent?.trim() || 'ZoiPass';
                    const priceEl = card?.querySelector('[class*="text-4xl"], [class*="text-5xl"]');
                    const price = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';

                    ZoiSubscription.subscribe({ name: planName, price: parseInt(price) });
                    btn.textContent = 'Subscribed ✓';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                });
            }
        });
    }

    // ─── WIRE: INDEX PAGE ───────────────────────────────────
    function wireIndexPage() {
        // Wire "Add" buttons on food cards
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();
            const icon = btn.querySelector('.material-symbols-outlined')?.textContent || '';

            if (text === 'add' || icon === 'add' || text === 'add to cart') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const card = btn.closest('div[class*="card"], div[class*="glass"], article, div[class*="border"]');
                    if (card) {
                        const name = card.querySelector('h3, h4, p[class*="font-bold"]')?.textContent?.trim() || 'Item';
                        const priceText = card.querySelector('[class*="price"], p:last-of-type, span')?.textContent || '';
                        const priceMatch = priceText.match(/₹\s*(\d+)/);
                        const price = priceMatch ? parseInt(priceMatch[1]) : 200;
                        const img = card.querySelector('img')?.src || '';

                        ZoiCart.add({
                            id: Date.now(),
                            name, price, img,
                            restId: '101',
                            restName: 'ZipZapZoi',
                            qty: 1
                        });
                    }
                });
            }

            // Order Now buttons → go to restaurants
            if (text.includes('order now') || text.includes('explore') || text.includes('browse')) {
                if (!btn.closest('a')) {
                    btn.addEventListener('click', () => {
                        window.location.href = 'customer_restaurant_listing.html';
                    });
                }
            }
        });
    }

    // ─── NOTIFICATION BELL WIDGET ───────────────────────────
    const NOTIFICATION_STYLES = `
    #zoi-notif-bell {
        position: fixed; top: 20px; right: 80px; z-index: 9997;
        width: 44px; height: 44px; border-radius: 50%;
        background: rgba(10,3,20,0.85); border: 1px solid #3c1e6e;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 20px;
        backdrop-filter: blur(12px);
        transition: all 0.3s ease;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    #zoi-notif-bell:hover { border-color: #00f0ff; transform: scale(1.1); }
    #zoi-notif-bell .bell-badge {
        position: absolute; top: -4px; right: -4px;
        min-width: 18px; height: 18px; border-radius: 9px;
        background: #ef4444; color: #fff; font-size: 10px;
        font-weight: 800; display: flex; align-items: center;
        justify-content: center; padding: 0 4px;
        border: 2px solid #0a0314;
        animation: zoi-bounce 0.5s ease;
    }
    @keyframes zoi-bounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
    #zoi-notif-panel {
        position: fixed; top: 72px; right: 24px; z-index: 9998;
        width: 360px; max-width: calc(100vw - 32px); max-height: 420px;
        background: #0a0314; border: 1px solid #3c1e6e;
        border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,0.6);
        display: none; flex-direction: column; overflow: hidden;
        font-family: 'Quicksand','Nunito',sans-serif;
    }
    #zoi-notif-panel.open { display: flex; animation: zoi-slide-in 0.25s ease; }
    @keyframes zoi-slide-in { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
    .notif-header {
        padding: 14px 16px; border-bottom: 1px solid #1a0b36;
        display: flex; justify-content: space-between; align-items: center;
        font-weight: 800; color: #00f0ff; font-size: 14px;
    }
    .notif-header button {
        background: none; border: 1px solid #3c1e6e; color: #b4a5d8;
        font-size: 11px; padding: 4px 10px; border-radius: 8px; cursor: pointer;
        font-family: inherit;
    }
    .notif-header button:hover { border-color: #00f0ff; color: #00f0ff; }
    .notif-list { overflow-y: auto; flex: 1; max-height: 350px; }
    .notif-item {
        padding: 12px 16px; border-bottom: 1px solid #1a0b3620;
        cursor: pointer; transition: background 0.2s;
        display: flex; gap: 10px; align-items: flex-start;
    }
    .notif-item:hover { background: rgba(0,240,255,0.05); }
    .notif-item.unread { background: rgba(0,240,255,0.08); border-left: 3px solid #00f0ff; }
    .notif-item .notif-icon { font-size: 18px; flex-shrink: 0; margin-top: 2px; }
    .notif-item .notif-body { flex: 1; }
    .notif-item .notif-title { font-weight: 700; color: #e0d4ff; font-size: 13px; }
    .notif-item .notif-text { color: #8b7faa; font-size: 12px; margin-top: 2px; }
    .notif-item .notif-time { color: #5a4d7a; font-size: 10px; margin-top: 4px; }
    .notif-empty { padding: 40px 16px; text-align: center; color: #5a4d7a; font-size: 13px; }
    `;

    const notifIcons = { order: '📦', promo: '🎉', system: '⚙️', achievement: '🏆', info: 'ℹ️' };

    function timeAgo(dateStr) {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    async function initNotificationBell() {
        if (typeof ZoiAPI === 'undefined' || !ZoiAPI.inAppNotifications) return;
        if (!window.ZoiCustomer?.isLoggedIn?.()) return;

        // Inject styles
        const style = document.createElement('style');
        style.textContent = NOTIFICATION_STYLES;
        document.head.appendChild(style);

        // Create bell
        const bell = document.createElement('div');
        bell.id = 'zoi-notif-bell';
        bell.innerHTML = '🔔';
        document.body.appendChild(bell);

        // Create panel
        const panel = document.createElement('div');
        panel.id = 'zoi-notif-panel';
        panel.innerHTML = `
            <div class="notif-header">
                <span>🔔 Notifications</span>
                <button id="notif-mark-all">Mark all read</button>
            </div>
            <div class="notif-list" id="notif-list"></div>
        `;
        document.body.appendChild(panel);

        // Toggle panel
        bell.addEventListener('click', async () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) await loadNotifications();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
                panel.classList.remove('open');
            }
        });

        // Mark all read
        document.getElementById('notif-mark-all').addEventListener('click', async () => {
            try {
                await ZoiAPI.inAppNotifications.markAllRead();
                updateBellBadge(0);
                document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
                showToast('All notifications marked as read', 'success');
            } catch (e) { showToast('Failed to mark notifications', 'error'); }
        });

        // Initial badge count
        try {
            const result = await ZoiAPI.inAppNotifications.list(1, 1);
            updateBellBadge(result.unreadCount || 0);
        } catch (e) { /* silent */ }

        // Poll every 60 seconds
        setInterval(async () => {
            try {
                const result = await ZoiAPI.inAppNotifications.list(1, 1);
                updateBellBadge(result.unreadCount || 0);
            } catch (e) { /* silent */ }
        }, 60000);
    }

    function updateBellBadge(count) {
        const bell = document.getElementById('zoi-notif-bell');
        if (!bell) return;
        const existing = bell.querySelector('.bell-badge');
        if (existing) existing.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'bell-badge';
            badge.textContent = count > 9 ? '9+' : count;
            bell.appendChild(badge);
        }
    }

    async function loadNotifications() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        list.innerHTML = '<div class="notif-empty">Loading...</div>';

        try {
            const result = await ZoiAPI.inAppNotifications.list(1, 20);
            const notifications = result.data || [];
            updateBellBadge(result.unreadCount || 0);

            if (notifications.length === 0) {
                list.innerHTML = '<div class="notif-empty">🔕 No notifications yet</div>';
                return;
            }

            list.innerHTML = notifications.map(n => `
                <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}" onclick="window._zoiMarkNotifRead(${n.id}, this)">
                    <span class="notif-icon">${notifIcons[n.type] || 'ℹ️'}</span>
                    <div class="notif-body">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-text">${n.body}</div>
                        <div class="notif-time">${timeAgo(n.createdAt)}</div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<div class="notif-empty">Failed to load notifications</div>';
        }
    }

    window._zoiMarkNotifRead = async (id, el) => {
        if (el.classList.contains('unread')) {
            try {
                await ZoiAPI.inAppNotifications.markRead(id);
                el.classList.remove('unread');
                const bell = document.getElementById('zoi-notif-bell');
                const badge = bell?.querySelector('.bell-badge');
                if (badge) {
                    const c = parseInt(badge.textContent) || 0;
                    if (c <= 1) badge.remove();
                    else badge.textContent = c - 1;
                }
            } catch (e) { /* silent */ }
        }
    };

    // ─── FAVORITES HEART HELPER ─────────────────────────────
    window.ZoiFavorites = {
        _cache: null,
        load: async () => {
            if (typeof ZoiAPI !== 'undefined' && ZoiAPI.favorites) {
                try {
                    ZoiFavorites._cache = await ZoiAPI.favorites.list();
                } catch (e) { ZoiFavorites._cache = []; }
            }
        },
        isFavorited: (type, id) => {
            if (!ZoiFavorites._cache) return false;
            return ZoiFavorites._cache.some(f =>
                f.type === type && (type === 'restaurant' ? f.restaurantId === id : f.menuItemId === id)
            );
        },
        toggle: async (type, id) => {
            if (typeof ZoiAPI === 'undefined' || !ZoiAPI.favorites) {
                showToast('Please log in to save favorites', 'warning');
                return;
            }
            try {
                const result = await ZoiAPI.favorites.toggle(
                    type,
                    type === 'restaurant' ? id : null,
                    type === 'dish' ? id : null
                );
                // Refresh cache
                await ZoiFavorites.load();
                showToast(result.favorited ? '❤️ Added to favorites!' : '💔 Removed from favorites', result.favorited ? 'success' : 'info');
                return result.favorited;
            } catch (e) {
                showToast('Login required to save favorites', 'warning');
                return null;
            }
        }
    };

    // ─── GLOBAL INIT ────────────────────────────────────────
    function init() {
        // Inject styles globally (including login) for toast support
        const style = document.createElement('style');
        style.textContent = TOAST_STYLES + `
            .zoi-user-active { color: #00f0ff !important; font-weight: 800 !important; }
        `;
        document.head.appendChild(style);

        // Don't wire page logic on admin/partner/POS/login pages
        const path = window.location.pathname.toLowerCase();
        if (path.includes('admin') || path.includes('partner') || path.includes('pos-') ||
            path.includes('hostel') || path.includes('rider') || path.includes('restaurant_management') ||
            path.includes('restaurant_settings') || path.includes('restaurant_staff') ||
            path.includes('restaurant_financials') || path.includes('restaurant_menu_manager') ||
            path.includes('restaurant_order') || path.includes('login')) {
            return;
        }

        // Global Logout Listener (Interception)
        document.addEventListener('click', (e) => {
            const el = e.target.closest('a, button');
            if (!el) return;
            
            const text = el.textContent.trim().toLowerCase();
            const id = el.id?.toLowerCase() || '';
            
            if (text === 'logout' || text === 'log out' || text === 'sign out' || id.includes('logout')) {
                e.preventDefault();
                e.stopPropagation();
                ZoiCustomer.logout();
            }
        }, true);

        // Update cart badges
        ZoiCart.updateBadges();

        // Update user state
        ZoiCustomer.updateUI();

        // Wire current page
        wireCurrentPage();

        // Init notification bell for logged-in users
        setTimeout(() => initNotificationBell(), 500);

        // Pre-load favorites cache
        if (window.ZoiCustomer?.isLoggedIn?.()) {
            ZoiFavorites.load();
        }

        // Listen for cart changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'zoiCart') ZoiCart.updateBadges();
            if (e.key === 'zoiCustomerSession' || e.key === 'zoiUser') ZoiCustomer.updateUI();
        });
    }

    // Make modules globally available
    window.ZoiCart = ZoiCart;
    window.ZoiCustomer = ZoiCustomer;
    window.ZoiProfile = ZoiProfile;
    window.ZoiFeedback = ZoiFeedback;
    window.ZoiReferral = ZoiReferral;
    window.ZoiCoupon = ZoiCoupon;
    window.ZoiSupport = ZoiSupport;
    window.ZoiReviews = ZoiReviews;
    window.ZoiOrderHistory = ZoiOrderHistory;
    window.ZoiLoyalty = ZoiLoyalty;
    window.ZoiSubscription = ZoiSubscription;
    window.zoiToast = showToast;
    window.showToast = showToast;

    // ─── AUTO-LOAD LOCATION DETECTION ────────────────────────
    (function loadLocationScript() {
        if (document.querySelector('script[src*="zoi_location"]')) return;
        const s = document.createElement('script');
        s.src = 'js/zoi_location.js?v=' + Date.now();
        s.defer = true;
        document.body.appendChild(s);
    })();

    // ─── AUTO-LOAD THEME & NAVIGATION FIX ────────────────────
    (function loadThemeScript() {
        if (document.querySelector('script[src*="zoi_theme"]')) return;
        const s = document.createElement('script');
        s.src = 'js/zoi_theme.js?v=' + Date.now();
        s.defer = true;
        document.body.appendChild(s);
    })();

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
