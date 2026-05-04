/**
 * ZoiEats Global Mobile Responsiveness Engine
 * Auto-fixes all sidebar-based layouts for mobile accessibility
 * Injects mobile hamburger nav, bottom nav bar, and responsive overrides
 */
(function () {
    'use strict';

    // ═══════════════════════════════════════
    // 1. INJECT GLOBAL RESPONSIVE STYLES
    // ═══════════════════════════════════════
    const style = document.createElement('style');
    style.id = 'zoi-mobile-responsive';
    style.textContent = `
        /* ── Mobile Bottom Navigation ── */
        #zoi-mobile-bottom-nav {
            display: none;
            position: fixed; bottom: 0; left: 0; right: 0; z-index: 9990;
            background: linear-gradient(180deg, rgba(15,17,21,0.95), rgba(15,17,21,1));
            border-top: 1px solid rgba(255,255,255,0.08);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            padding: 6px 0 max(6px, env(safe-area-inset-bottom));
        }
        #zoi-mobile-bottom-nav .nav-items { display: flex; justify-content: space-around; align-items: center; }
        #zoi-mobile-bottom-nav a, #zoi-mobile-bottom-nav button {
            display: flex; flex-direction: column; align-items: center; gap: 2px;
            font-size: 10px; color: #9ca3af; text-decoration: none;
            padding: 4px 8px; border-radius: 8px; background: none; border: none; cursor: pointer;
            transition: color 0.2s;
        }
        #zoi-mobile-bottom-nav a.active, #zoi-mobile-bottom-nav button.active { color: #00f0ff; }
        #zoi-mobile-bottom-nav a:hover, #zoi-mobile-bottom-nav button:hover { color: #fff; }
        #zoi-mobile-bottom-nav .material-symbols-outlined { font-size: 22px; }

        /* ── Mobile Sidebar Overlay ── */
        #zoi-mobile-sidebar-overlay {
            display: none; position: fixed; inset: 0; z-index: 9998;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        }
        #zoi-mobile-sidebar-drawer {
            position: fixed; top: 0; left: 0; bottom: 0; width: min(80vw, 320px); z-index: 9999;
            background: #0f1115; border-right: 1px solid rgba(255,255,255,0.08);
            transform: translateX(-100%); transition: transform 0.3s ease;
            overflow-y: auto; -webkit-overflow-scrolling: touch;
        }
        #zoi-mobile-sidebar-drawer.open { transform: translateX(0); }
        #zoi-mobile-sidebar-overlay.open { display: block; }

        /* ── Mobile Header Bar ── */
        #zoi-mobile-header {
            display: none; position: sticky; top: 0; z-index: 9989;
            background: rgba(15,17,21,0.95); backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding: 12px 16px; align-items: center; justify-content: space-between;
        }

        @media (max-width: 768px) {
            /* Show mobile UI */
            #zoi-mobile-bottom-nav { display: block !important; }
            #zoi-mobile-header { display: flex !important; }

            /* Fix body for mobile */
            body {
                padding-bottom: 72px !important;
                overflow-x: hidden !important;
            }

            /* Hide desktop sidebar (already hidden via md:flex on most) */
            aside:not(#zoi-mobile-sidebar-drawer) { display: none !important; }

            /* Fix main content overflow */
            body.bg-bg, body[class*="overflow-hidden"] {
                overflow-y: auto !important;
                height: auto !important;
                min-height: 100vh;
            }
            main { overflow: visible !important; height: auto !important; min-height: calc(100vh - 120px); }

            /* Fix grid layouts */
            .grid-cols-3 { grid-template-columns: 1fr !important; }
            .grid-cols-4 { grid-template-columns: repeat(2, 1fr) !important; }
            .lg\\:grid-cols-3, .xl\\:grid-cols-4, .lg\\:grid-cols-4 { grid-template-columns: 1fr !important; }
            .md\\:grid-cols-2 { grid-template-columns: 1fr !important; }

            /* Fix flex layouts */
            .flex.h-screen { flex-direction: column !important; height: auto !important; min-height: 100vh; }

            /* Fix desktop-only headers */
            header .hidden.md\\:flex, header .hidden.md\\:block,
            header .hidden.lg\\:flex, header .hidden.lg\\:block { display: none !important; }

            /* Fix table responsiveness */
            table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            thead { white-space: nowrap; }

            /* Fix modals on mobile */
            .fixed.inset-0[class*="flex"][class*="items-center"] > div {
                max-width: calc(100vw - 32px) !important; max-height: calc(100vh - 32px) !important;
                margin: 16px !important; overflow-y: auto !important;
            }

            /* Stats strip mobile */
            .stats-strip { flex-wrap: wrap !important; }
            .stat-card { flex: 1 1 calc(50% - 2px) !important; min-width: 0; }

            /* Fix KDS columns on mobile */
            #view-live { grid-template-columns: 1fr !important; gap: 12px !important; padding: 12px !important; }

            /* Fix POS terminal on mobile */
            .grid.grid-cols-5 { grid-template-columns: repeat(2, 1fr) !important; }
            .grid.grid-cols-6 { grid-template-columns: repeat(3, 1fr) !important; }

            /* Fix partner dashboard cards */
            .lg\\:col-span-4, .lg\\:col-span-8, .lg\\:col-span-12 { grid-column: span 1 !important; }

            /* Fix spacing */
            .px-6 { padding-left: 16px !important; padding-right: 16px !important; }
            .px-8, .px-10, .lg\\:px-8, .lg\\:px-10 { padding-left: 16px !important; padding-right: 16px !important; }

            /* Fix text sizes for readability */
            .text-4xl { font-size: 1.75rem !important; }
            .text-3xl { font-size: 1.5rem !important; }
            .text-2xl { font-size: 1.25rem !important; }

            /* Mobile-friendly buttons */
            button, a[class*="rounded-lg"] { min-height: 44px; min-width: 44px; }

            /* Fix dual-panel layouts */
            .flex.flex-col.md\\:flex-row { flex-direction: column !important; }
            .md\\:w-1\\/4, .md\\:w-1\\/3, .md\\:w-1\\/2 { width: 100% !important; }

            /* Hide desktop-only elements */
            .hidden.md\\:flex, .hidden.md\\:block, .hidden.md\\:inline-flex,
            .hidden.lg\\:flex, .hidden.lg\\:block, .hidden.lg\\:inline-flex { display: none !important; }
        }

        /* ── Tablet tweaks ── */
        @media (min-width: 769px) and (max-width: 1024px) {
            .grid-cols-3 { grid-template-columns: repeat(2, 1fr) !important; }
            .xl\\:grid-cols-4, .lg\\:grid-cols-4 { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* ── Drawer link styles ── */
        #zoi-mobile-sidebar-drawer a {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px; color: #9ca3af; text-decoration: none;
            font-size: 14px; font-weight: 500; border-radius: 10px;
            transition: all 0.2s;
        }
        #zoi-mobile-sidebar-drawer a:hover, #zoi-mobile-sidebar-drawer a:active {
            background: rgba(255,255,255,0.05); color: #fff;
        }
        #zoi-mobile-sidebar-drawer a.active-link {
            background: rgba(0,240,255,0.1); color: #00f0ff; font-weight: 700;
        }
        #zoi-mobile-sidebar-drawer .section-title {
            padding: 16px 16px 6px; font-size: 10px; font-weight: 700;
            color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em;
        }
    `;
    document.head.appendChild(style);

    // ═══════════════════════════════════════
    // 2. DETECT PAGE TYPE & BUILD NAVIGATION
    // ═══════════════════════════════════════
    function getPageType() {
        const path = decodeURIComponent(window.location.pathname.toLowerCase());
        const file = path.split('/').pop() || 'index.html';
        if (file.startsWith('admin')) return 'admin';
        if (file.startsWith('hostel_')) return 'hostel';
        if (file.startsWith('standalone_')) return 'standalone';
        if (file.startsWith('restaurant') || file.startsWith('rider')) return 'partner';
        return 'customer';
    }

    function getBottomNavItems(type) {
        switch (type) {
            case 'admin':
                return [
                    { icon: 'dashboard', label: 'Dashboard', href: 'admin console dashboard V2.html' },
                    { icon: 'group', label: 'Users', href: 'admin useraccount management.html' },
                    { icon: 'gavel', label: 'Disputes', href: 'admin dispute resolution.html' },
                    { icon: 'analytics', label: 'Metrics', href: 'admin deliverypartner Metrics.html' },
                    { icon: 'menu', label: 'More', action: 'openDrawer' }
                ];
            case 'partner':
                return [
                    { icon: 'dashboard', label: 'Dashboard', href: 'restaurant_partner_dashboard.html' },
                    { icon: 'cooking', label: 'KDS', href: 'restaurant_live_orders_kds.html' },
                    { icon: 'restaurant_menu', label: 'Menu', href: 'restaurant_menu_manager.html' },
                    { icon: 'account_balance_wallet', label: 'Finance', href: 'restaurant_financials.html' },
                    { icon: 'menu', label: 'More', action: 'openDrawer' }
                ];
            case 'hostel':
                return [
                    { icon: 'grid_view', label: 'Overview', href: 'hostel_pos_dashboard.html' },
                    { icon: 'bed', label: 'Rooms', href: 'hostel_rooms.html' },
                    { icon: 'group', label: 'Hostelers', href: 'hostel_hostelers.html' },
                    { icon: 'receipt_long', label: 'Billing', href: 'hostel_billing.html' },
                    { icon: 'menu', label: 'More', action: 'openDrawer' }
                ];
            case 'customer':
                return [
                    { icon: 'home', label: 'Home', href: 'index.html' },
                    { icon: 'search', label: 'Search', href: 'search_results.html' },
                    { icon: 'shopping_bag', label: 'Cart', href: 'shopping_cart.html' },
                    { icon: 'receipt_long', label: 'Orders', href: 'customer_orders history.html' },
                    { icon: 'person', label: 'Profile', href: 'customer profile.html' }
                ];
            default: return [];
        }
    }

    // ═══════════════════════════════════════
    // 3. BUILD MOBILE UI COMPONENTS
    // ═══════════════════════════════════════
    function init() {
        if (window.innerWidth > 768) return; // Only for mobile
        const type = getPageType();
        const currentFile = decodeURIComponent(window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

        // ── Mobile Header ──
        const header = document.createElement('div');
        header.id = 'zoi-mobile-header';
        const brandName = { admin: 'AdminConsole', partner: 'Partner Hub', hostel: 'Hostel POS', customer: 'ZoiEats', standalone: 'POS' }[type] || 'ZoiEats';
        const brandColor = type === 'hostel' ? '#ec4899' : '#00f0ff';
        header.innerHTML = `
            <button id="zoi-hamburger" style="background:none;border:none;color:#fff;cursor:pointer;padding:8px;margin:-8px;border-radius:8px">
                <span class="material-symbols-outlined" style="font-size:24px">menu</span>
            </button>
            <span style="font-weight:800;font-size:16px;color:#fff;letter-spacing:-0.5px">${brandName.replace(/(Eats|Console|Hub|POS)/, `<span style="color:${brandColor}">$1</span>`)}</span>
            <div style="display:flex;gap:8px">
                ${type === 'customer' ? '<a href="shopping_cart.html" style="color:#fff;padding:8px"><span class="material-symbols-outlined">shopping_bag</span></a>' : ''}
                ${type !== 'customer' ? '<button onclick="handleLogout()" style="background:none;border:none;color:#9ca3af;cursor:pointer;padding:8px"><span class="material-symbols-outlined" style="font-size:20px">logout</span></button>' : ''}
            </div>
        `;

        // ── Bottom Nav ──
        const bottomNav = document.createElement('div');
        bottomNav.id = 'zoi-mobile-bottom-nav';
        const items = getBottomNavItems(type);
        bottomNav.innerHTML = `<div class="nav-items">${items.map(it => {
            const isActive = it.href && currentFile === it.href.toLowerCase();
            if (it.action === 'openDrawer') {
                return `<button onclick="zoiToggleMobileDrawer()" class="${isActive ? 'active' : ''}"><span class="material-symbols-outlined">${it.icon}</span>${it.label}</button>`;
            }
            return `<a href="${it.href}" class="${isActive ? 'active' : ''}"><span class="material-symbols-outlined">${it.icon}</span>${it.label}</a>`;
        }).join('')}</div>`;

        // ── Sidebar Drawer ──
        const overlay = document.createElement('div');
        overlay.id = 'zoi-mobile-sidebar-overlay';
        overlay.onclick = () => zoiToggleMobileDrawer(false);

        const drawer = document.createElement('div');
        drawer.id = 'zoi-mobile-sidebar-drawer';
        // Copy links from existing sidebar
        const existingSidebar = document.querySelector('aside');
        if (existingSidebar) {
            drawer.innerHTML = existingSidebar.innerHTML;
            // Highlight active link
            drawer.querySelectorAll('a').forEach(a => {
                const href = decodeURIComponent(a.getAttribute('href') || '').toLowerCase();
                if (href === currentFile) a.classList.add('active-link');
            });
        } else {
            // Build from bottom nav items (fallback for customer pages)
            drawer.innerHTML = `
                <div style="padding:20px 16px;border-bottom:1px solid rgba(255,255,255,0.08)">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font-weight:800;font-size:18px;color:#fff">${brandName}</span>
                        <button onclick="zoiToggleMobileDrawer(false)" style="background:none;border:none;color:#666;cursor:pointer;padding:4px">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <nav style="padding:12px 8px">
                    ${getCustomerDrawerLinks(currentFile)}
                </nav>
            `;
        }

        // ── Inject into DOM ──
        document.body.prepend(header);
        document.body.appendChild(bottomNav);
        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        // ── Wire hamburger ──
        const hamburger = document.getElementById('zoi-hamburger');
        if (hamburger) hamburger.addEventListener('click', () => zoiToggleMobileDrawer(true));
    }

    function getCustomerDrawerLinks(currentFile) {
        const links = [
            { section: 'Browse', items: [
                { icon: 'home', label: 'Home', href: 'index.html' },
                { icon: 'storefront', label: 'Restaurants', href: 'customer_restaurant_listing.html' },
                { icon: 'search', label: 'Search', href: 'search_results.html' },
                { icon: 'local_offer', label: 'Offers & Promos', href: 'promotions & offers.html' }
            ]},
            { section: 'My Account', items: [
                { icon: 'shopping_bag', label: 'Cart', href: 'shopping_cart.html' },
                { icon: 'receipt_long', label: 'Order History', href: 'customer_orders history.html' },
                { icon: 'person', label: 'Profile', href: 'customer profile.html' },
                { icon: 'location_on', label: 'Addresses', href: 'customer address management.html' },
                { icon: 'payments', label: 'Wallet', href: 'customer wallet.html' }
            ]},
            { section: 'Rewards', items: [
                { icon: 'sports_esports', label: 'Gamification Hub', href: 'customer gamification hub.html' },
                { icon: 'share', label: 'Refer & Earn', href: 'customer referral program.html' },
                { icon: 'workspace_premium', label: 'ZoiPass', href: 'Customer subscription service.html' }
            ]},
            { section: 'Support', items: [
                { icon: 'help', label: 'Help Center', href: 'customer support help.html' },
                { icon: 'feedback', label: 'Feedback', href: 'feedback.html' },
                { icon: 'info', label: 'About Us', href: 'about us.html' }
            ]}
        ];
        return links.map(s => `
            <div class="section-title">${s.section}</div>
            ${s.items.map(it => `
                <a href="${it.href}" class="${currentFile === it.href.toLowerCase() ? 'active-link' : ''}">
                    <span class="material-symbols-outlined" style="font-size:20px">${it.icon}</span> ${it.label}
                </a>
            `).join('')}
        `).join('');
    }

    // ═══════════════════════════════════════
    // 4. DRAWER TOGGLE
    // ═══════════════════════════════════════
    window.zoiToggleMobileDrawer = function (open) {
        const drawer = document.getElementById('zoi-mobile-sidebar-drawer');
        const overlay = document.getElementById('zoi-mobile-sidebar-overlay');
        if (!drawer || !overlay) return;
        const isOpen = drawer.classList.contains('open');
        const shouldOpen = open !== undefined ? open : !isOpen;
        drawer.classList.toggle('open', shouldOpen);
        overlay.classList.toggle('open', shouldOpen);
        document.body.style.overflow = shouldOpen ? 'hidden' : '';
    };

    // ═══════════════════════════════════════
    // 5. INIT ON LOAD
    // ═══════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-check on resize
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if ((lastWidth > 768 && window.innerWidth <= 768) || (lastWidth <= 768 && window.innerWidth > 768)) {
            lastWidth = window.innerWidth;
            const existing = ['zoi-mobile-header', 'zoi-mobile-bottom-nav', 'zoi-mobile-sidebar-overlay', 'zoi-mobile-sidebar-drawer'];
            existing.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
            if (window.innerWidth <= 768) init();
        }
    });
})();
