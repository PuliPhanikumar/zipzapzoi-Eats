/**
 * ZipZapZoi — Centralized Theme & Navigation Fix
 * ================================================
 * Auto-loaded on every page via zoi_customer_engine.js.
 * Fixes: old orange→neon cyan theme, footer links, nav headers, AI assistant loading.
 */
(function () {
    'use strict';

    // ══════════════════════════════════════════════════════
    // 1. GLOBAL THEME OVERRIDE CSS
    // ══════════════════════════════════════════════════════
    const THEME_CSS = `
    /* === ZipZapZoi Neon Theme Override === */

    /* Override old orange primary → neon cyan */
    [style*="color: #f27f0d"], [style*="color:#f27f0d"] { color: #00f0ff !important; }
    [style*="background-color: #f27f0d"], [style*="background:#f27f0d"],
    [style*="background-color:#f27f0d"] { background-color: #00f0ff !important; }
    [style*="border-color: #f27f0d"], [style*="border-color:#f27f0d"] { border-color: #00f0ff !important; }

    /* Override old dark brown background → deep purple */
    [style*="background-color: #231a10"], [style*="background:#231a10"],
    [style*="background-color:#231a10"] { background-color: #0a0314 !important; }
    [style*="color: #231a10"], [style*="color:#231a10"] { color: #0a0314 !important; }

    /* Tailwind dynamic class overrides for orange variants */
    .bg-\\[\\#f27f0d\\] { background-color: #00f0ff !important; }
    .text-\\[\\#f27f0d\\] { color: #00f0ff !important; }
    .border-\\[\\#f27f0d\\] { border-color: #00f0ff !important; }
    .ring-\\[\\#f27f0d\\] { --tw-ring-color: #00f0ff !important; }
    .shadow-\\[\\#f27f0d\\] { --tw-shadow-color: #00f0ff !important; }

    .bg-\\[\\#231a10\\] { background-color: #0a0314 !important; }
    .text-\\[\\#231a10\\] { color: #0a0314 !important; }
    .from-\\[\\#231a10\\] { --tw-gradient-from: #0a0314 !important; }
    .to-\\[\\#231a10\\] { --tw-gradient-to: #0a0314 !important; }
    .via-\\[\\#231a10\\] { --tw-gradient-via: #0a0314 !important; }

    /* Surface dark overrides */
    .bg-\\[\\#2d241b\\] { background-color: #1a0b36 !important; }

    /* Override shadow-orange → shadow-cyan */
    .shadow-orange-500\\/20 { --tw-shadow-color: rgba(0, 240, 255, 0.2) !important; }
    .shadow-orange-500\\/30 { --tw-shadow-color: rgba(0, 240, 255, 0.3) !important; }

    /* Override hover:bg-orange → hover:bg-cyan */
    .hover\\:bg-orange-500:hover { background-color: #00d7e6 !important; }
    .hover\\:bg-orange-600:hover { background-color: #00c4d4 !important; }

    /* Fix any remaining orange text */
    .text-orange-500, .text-orange-600 { color: #00f0ff !important; }
    .bg-orange-500, .bg-orange-600 { background-color: #00f0ff !important; }
    .border-orange-500 { border-color: #00f0ff !important; }

    /* Footer consistent styling */
    footer a, .footer a { transition: color 0.2s ease; }
    footer a:hover, .footer a:hover { color: #00f0ff !important; }

    /* Smooth scroll for all pages */
    html { scroll-behavior: smooth; }

    /* === 3D Glass & Neumorphic Effects === */
    .glass-panel { 
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 10px 40px rgba(0,0,0,0.4) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        transform: translateZ(0);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bouncy-card { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
    .bouncy-card:hover { transform: translateY(-8px) scale(1.02) !important; box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important; }

    /* === Light Mode Overrides === */
    html.theme-light body { background-color: #f8fafc !important; color: #0f172a !important; }
    html.theme-light .text-white { color: #0f172a !important; }
    html.theme-light .text-gray-400 { color: #475569 !important; }
    html.theme-light .text-gray-300 { color: #334155 !important; }
    html.theme-light .bg-\\[\\#0a0314\\] { background-color: #ffffff !important; }
    html.theme-light .bg-\\[\\#1a0b36\\] { background-color: #f1f5f9 !important; }
    html.theme-light .border-white\\/10 { border-color: rgba(0,0,0,0.1) !important; }
    html.theme-light .border-border { border-color: rgba(0,0,0,0.1) !important; }
    html.theme-light .bg-white\\/\\[0\\.03\\] { background-color: rgba(0,0,0,0.03) !important; }
    html.theme-light .bg-white\\/5 { background-color: rgba(0,0,0,0.04) !important; }
    html.theme-light .glass-panel, html.theme-light .bg-surface { 
        background: rgba(255,255,255,0.95) !important; 
        border: 1px solid rgba(0,0,0,0.08) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 10px 40px rgba(0,0,0,0.06) !important;
    }

    /* === Sunset Warmth Mode Overrides === */
    html.theme-sunset body { background-color: #1a0505 !important; }
    html.theme-sunset .bg-\\[\\#0a0314\\] { background-color: #1a0505 !important; }
    html.theme-sunset .bg-\\[\\#1a0b36\\] { background-color: #2b0c0c !important; }
    html.theme-sunset .text-\\[\\#00f0ff\\] { color: #ff5a00 !important; }
    html.theme-sunset .text-pink-400 { color: #ff2a55 !important; }
    html.theme-sunset .border-\\[\\#00f0ff\\] { border-color: #ff5a00 !important; }
    html.theme-sunset .bg-gradient-to-r { --tw-gradient-from: #ff5a00 !important; --tw-gradient-to: #ff0055 !important; }
    html.theme-sunset .shadow-\\[\\#00f0ff\\] { --tw-shadow-color: rgba(255,90,0,0.4) !important; }

    /* === Ocean Depths Mode Overrides === */
    html.theme-ocean body { background-color: #020617 !important; }
    html.theme-ocean .bg-\\[\\#0a0314\\] { background-color: #0f172a !important; }
    html.theme-ocean .bg-\\[\\#1a0b36\\] { background-color: #1e293b !important; }
    html.theme-ocean .text-\\[\\#00f0ff\\] { color: #38bdf8 !important; }
    html.theme-ocean .text-pink-400 { color: #818cf8 !important; }
    html.theme-ocean .border-\\[\\#00f0ff\\] { border-color: #38bdf8 !important; }
    html.theme-ocean .bg-gradient-to-r { --tw-gradient-from: #0ea5e9 !important; --tw-gradient-to: #4f46e5 !important; }
    html.theme-ocean .shadow-\\[\\#00f0ff\\] { --tw-shadow-color: rgba(56,189,248,0.4) !important; }

    /* =========================================================
       ✨ ZOI 3D EFFECTS ENGINE (APPLIED GLOBALLY) ✨
       ========================================================= */
    .zoi-3d-layer {
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, filter 0.4s ease !important;
        transform-style: preserve-3d;
        will-change: transform, box-shadow;
    }
    .zoi-3d-layer:hover {
        transform: perspective(1200px) rotateX(2deg) rotateY(-2deg) translateY(-6px) scale(1.02) !important;
        box-shadow: 
            20px 20px 60px rgba(0, 0, 0, 0.5), 
            -5px -5px 20px rgba(0, 240, 255, 0.15),
            inset 0 1px 1px rgba(255, 255, 255, 0.2) !important;
        z-index: 50;
    }
    
    .zoi-3d-btn {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease !important;
    }
    .zoi-3d-btn:hover {
        transform: perspective(500px) translateZ(10px) translateY(-2px) scale(1.05) !important;
        box-shadow: 0 10px 25px rgba(0, 240, 255, 0.3), inset 0 2px 5px rgba(255, 255, 255, 0.3) !important;
    }
    .zoi-3d-btn:active {
        transform: perspective(500px) translateZ(-5px) translateY(2px) scale(0.95) !important;
    }

    .zoi-3d-image {
        transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.6s ease !important;
    }
    .zoi-3d-layer:hover .zoi-3d-image {
        transform: translateZ(30px) scale(1.08) !important;
        filter: brightness(1.1) contrast(1.1) !important;
    }

    @keyframes zoi3DFloat {
        0%, 100% { transform: translateY(0) rotateX(0) rotateY(0); }
        25% { transform: translateY(-5px) rotateX(1deg) rotateY(1deg); }
        75% { transform: translateY(3px) rotateX(-1deg) rotateY(-1deg); }
    }
    .zoi-3d-float {
        animation: zoi3DFloat 6s ease-in-out infinite;
    }
    `;

    // Inject theme CSS
    if (!document.getElementById('zoi-theme-override')) {
        const style = document.createElement('style');
        style.id = 'zoi-theme-override';
        style.textContent = THEME_CSS;
        document.head.appendChild(style);
    }

    // ══════════════════════════════════════════════════════
    // 1.5 GLOBAL FONT ENGINE
    // ══════════════════════════════════════════════════════
    const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap";
    if (!document.getElementById('zoi-google-fonts')) {
        const link = document.createElement('link');
        link.id = 'zoi-google-fonts';
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONTS_URL;
        document.head.appendChild(link);
    }

    // ══════════════════════════════════════════════════════
    // 2. TAILWIND CONFIG PATCHER
    // ══════════════════════════════════════════════════════
    // Override Tailwind's runtime config if it uses old colors
    if (typeof tailwind !== 'undefined' && tailwind.config) {
        const colors = tailwind.config?.theme?.extend?.colors;
        if (colors) {
            if (colors.primary === '#f27f0d') colors.primary = '#00f0ff';
            if (colors['background-dark'] === '#231a10') colors['background-dark'] = '#0a0314';
            if (colors['surface-dark'] === '#2d241b') colors['surface-dark'] = '#1a0b36';
        }
    }

    // ══════════════════════════════════════════════════════
    // 3. FOOTER LINK FIXER
    // ══════════════════════════════════════════════════════
    const FOOTER_LINKS = {
        // Company
        'about us': 'about us.html',
        'about': 'about us.html',
        'career': 'careerspage.html',
        'careers': 'careerspage.html',
        'press': 'press & media kit.html',
        'media': 'press & media kit.html',
        'press & media': 'press & media kit.html',
        'developer': 'dev_hub.html',
        'developer hub': 'dev_hub.html',
        'api': 'dev_hub.html',

        // Legal
        'privacy': 'privacy policy.html',
        'privacy policy': 'privacy policy.html',
        'terms': 'terms&conditions.html',
        'terms & conditions': 'terms&conditions.html',
        'terms and conditions': 'terms&conditions.html',
        'gst': 'gst disclaimer.html',
        'gst disclaimer': 'gst disclaimer.html',

        // Customer
        'help': 'customer support help.html',
        'support': 'customer support help.html',
        'customer support': 'customer support help.html',
        'feedback': 'feedback.html',
        'promotions': 'promotions & offers.html',
        'offers': 'promotions & offers.html',
        'promotions & offers': 'promotions & offers.html',
        'referral': 'customer referral program.html',
        'refer': 'customer referral program.html',
        'loyalty': 'Customer restaurant loyality programs.html',
        'subscription': 'Customer subscription service.html',
        'orders': 'customer_orders history.html',
        'order history': 'customer_orders history.html',
        'profile': 'customer profile.html',
        'my account': 'customer profile.html',
        'restaurants': 'customer_restaurant_listing.html',
        'browse restaurants': 'customer_restaurant_listing.html',

        // Partner — Pricing Plans is the entry point (see costs first)
        'partner': 'restaurant pricing plans.html',
        'partner registration': 'restaurant pricing plans.html',
        'become a partner': 'restaurant pricing plans.html',
        'register restaurant': 'restaurant pricing plans.html',
        'add restaurant': 'restaurant pricing plans.html',
        'pricing': 'restaurant pricing plans.html',
        'pricing plans': 'restaurant pricing plans.html',
        'onboarding': 'restaurant partner onboarding.html',
        'partner onboarding': 'restaurant partner onboarding.html',
        'restaurant onboarding': 'restaurant partner onboarding.html',
        'partner dashboard': 'restaurant_partner_dashboard.html',

        // Rider
        'rider': 'delivery partner application.html',
        'become a rider': 'delivery partner application.html',
        'ride with us': 'delivery partner application.html',
        'deliver': 'delivery partner application.html',
        'delivery partner': 'delivery partner application.html',

        // Sign In
        'sign in': 'login & registration.html',
        'login': 'login & registration.html',
        'log in': 'login & registration.html',
        'register': 'login & registration.html',

        // Cart
        'cart': 'shopping_cart.html',

        // Gamification
        'gamification': 'customer gamification hub.html',
        'achievements': 'customer gamification hub.html',

        // Tracking
        'track order': 'customer order_tracking.html',
        'tracking': 'customer order_tracking.html',
    };

    function fixFooterLinks() {
        const footerEl = document.querySelector('footer') ||
            document.querySelector('[class*="footer"]') ||
            document.querySelector('[role="contentinfo"]');
        if (!footerEl) return;

        footerEl.querySelectorAll('a').forEach(link => {
            const text = (link.textContent || '').trim().toLowerCase();
            const href = (link.getAttribute('href') || '').trim();

            // Fix empty or "#" links
            if (!href || href === '#' || href === 'javascript:void(0)') {
                // Try to match by link text
                for (const [key, target] of Object.entries(FOOTER_LINKS)) {
                    if (text.includes(key)) {
                        link.href = target;
                        break;
                    }
                }
            }
        });

        // Also fix any nav links with href="#"
        document.querySelectorAll('nav a[href="#"], header a[href="#"]').forEach(link => {
            const text = (link.textContent || '').trim().toLowerCase();
            for (const [key, target] of Object.entries(FOOTER_LINKS)) {
                if (text === key || text.includes(key)) {
                    link.href = target;
                    break;
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // 4. NAVIGATION HEADER SYNC
    // ══════════════════════════════════════════════════════
    function syncNavigation() {
        // Fix logo links — ensure they go to index.html
        document.querySelectorAll('header a, nav a').forEach(link => {
            const text = (link.textContent || '').trim().toLowerCase();
            const href = link.getAttribute('href') || '';
            if ((text.includes('zipzapzoi') || link.querySelector('[class*="bolt"]')) &&
                (!href || href === '#')) {
                link.href = 'index.html';
            }
        });

        // Fix cart links
        document.querySelectorAll('a[href*="cart"], a[href="#cart"]').forEach(link => {
            if (link.getAttribute('href') === '#cart' || link.getAttribute('href') === '#') {
                link.href = 'shopping_cart.html';
            }
        });
        // Also find cart icons without proper links
        document.querySelectorAll('header .material-symbols-outlined, nav .material-symbols-outlined').forEach(icon => {
            if (icon.textContent.trim() === 'shopping_cart') {
                const parent = icon.closest('a') || icon.closest('button');
                if (parent && parent.tagName === 'BUTTON') {
                    parent.addEventListener('click', () => { window.location.href = 'shopping_cart.html'; });
                } else if (parent && parent.tagName === 'A' && (!parent.href || parent.href.endsWith('#'))) {
                    parent.href = 'shopping_cart.html';
                }
            }
        });

        // Fix search functionality — wire search inputs in headers
        document.querySelectorAll('header input[type="search"], header input[type="text"], nav input[type="search"]').forEach(input => {
            if (input.placeholder && (input.placeholder.toLowerCase().includes('search') || input.placeholder.toLowerCase().includes('find'))) {
                if (!input._zoiSearchWired) {
                    input._zoiSearchWired = true;
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && input.value.trim()) {
                            window.location.href = 'customer_restaurant_listing.html?q=' + encodeURIComponent(input.value.trim());
                        }
                    });
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // 5. AI ASSISTANT AUTO-LOADER
    // ══════════════════════════════════════════════════════
    function ensureAIAssistant() {
        if (document.querySelector('script[src*="zoi_ai_assistant"]')) return;
        // Check if db_simulation.js and customer_engine are loaded
        if (!document.querySelector('script[src*="zoi_customer_engine"]')) return;

        const s = document.createElement('script');
        s.src = 'js/zoi_ai_assistant.js?v=5';
        s.defer = true;
        document.body.appendChild(s);
    }

    // ══════════════════════════════════════════════════════
    // 6. ADMIN/PARTNER PAGE LINK CONNECTOR
    // ══════════════════════════════════════════════════════
    function connectAdminPartnerLinks() {
        // Wire any "Admin" links in nav/footer
        document.querySelectorAll('a').forEach(link => {
            const text = (link.textContent || '').trim().toLowerCase();
            const href = link.getAttribute('href') || '';
            if (href === '#' || !href) {
                if (text === 'admin' || text === 'admin console' || text === 'admin dashboard') {
                    link.href = 'admin manager dashboard.html';
                }
                if (text === 'partner dashboard' || text === 'restaurant dashboard') {
                    link.href = 'restaurant_partner_dashboard.html';
                }
                if (text === 'rider dashboard') {
                    link.href = 'rider_dashboard.html';
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // 7. INLINE STYLE PATCHER (catches dynamic/inline orange)
    // ══════════════════════════════════════════════════════
    function patchInlineStyles() {
        document.querySelectorAll('[style]').forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('#f27f0d')) {
                el.setAttribute('style', style.replace(/#f27f0d/gi, '#00f0ff'));
            }
            if (style && style.includes('#231a10')) {
                el.setAttribute('style', style.replace(/#231a10/gi, '#0a0314'));
            }
            if (style && style.includes('#2d241b')) {
                el.setAttribute('style', style.replace(/#2d241b/gi, '#1a0b36'));
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // 8. THEME & FONT CUSTOMIZER SYSTEM
    // ══════════════════════════════════════════════════════
    const THEME_MODE_KEY = 'zoiThemeMode';
    const THEME_FONT_KEY = 'zoiFontFamily';
    const htmlEl = document.documentElement;

    const FONTS = {
        'manrope': '"Manrope", sans-serif',
        'inter': '"Inter", sans-serif',
        'outfit': '"Outfit", sans-serif',
        'poppins': '"Poppins", sans-serif'
    };

    // Apply saved preferences IMMEDIATELY (prevent flash)
    (function applySavedPrefs() {
        try {
            const savedTheme = localStorage.getItem(THEME_MODE_KEY) || 'dark';
            htmlEl.classList.remove('dark', 'theme-light', 'theme-sunset', 'theme-ocean');
            if (savedTheme === 'dark') htmlEl.classList.add('dark');
            else if (savedTheme === 'light') htmlEl.classList.add('theme-light');
            else if (savedTheme === 'sunset') htmlEl.classList.add('theme-sunset', 'dark');
            else if (savedTheme === 'ocean') htmlEl.classList.add('theme-ocean', 'dark');

            const savedFont = localStorage.getItem(THEME_FONT_KEY) || 'manrope';
            document.body.style.setProperty('font-family', FONTS[savedFont], 'important');
        } catch (e) { }
    })();

    function setThemeMode(mode) {
        htmlEl.classList.remove('dark', 'theme-light', 'theme-sunset', 'theme-ocean');
        if (mode === 'dark') htmlEl.classList.add('dark');
        else if (mode === 'light') htmlEl.classList.add('theme-light');
        else if (mode === 'sunset') htmlEl.classList.add('theme-sunset', 'dark');
        else if (mode === 'ocean') htmlEl.classList.add('theme-ocean', 'dark');
        
        try { localStorage.setItem(THEME_MODE_KEY, mode); } catch (e) { }
        updateCustomizerUI();
    }

    function setFontFamily(fontKey) {
        if (FONTS[fontKey]) {
            document.body.style.setProperty('font-family', FONTS[fontKey], 'important');
            try { localStorage.setItem(THEME_FONT_KEY, fontKey); } catch (e) { }
            updateCustomizerUI();
        }
    }

    function updateCustomizerUI() {
        const mode = localStorage.getItem(THEME_MODE_KEY) || 'dark';
        const fontKey = localStorage.getItem(THEME_FONT_KEY) || 'manrope';
        
        // Update the floating cog styling if it exists
        const popup = document.getElementById('zoi-customizer-popup');
        if (popup) {
            // Update Buttons State
            popup.querySelectorAll('.theme-btn').forEach(btn => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
                btn.style.border = '2px solid transparent';
            });
            const activeThemeBtn = popup.querySelector(`[data-theme="${mode}"]`);
            if (activeThemeBtn) {
                activeThemeBtn.style.transform = 'scale(1.05)';
                activeThemeBtn.style.border = '2px solid rgba(255,255,255,0.8)';
                activeThemeBtn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
            }

            popup.querySelectorAll('.font-btn').forEach(btn => btn.style.borderColor = 'transparent');
            const activeFontBtn = popup.querySelector(`[data-font="${fontKey}"]`);
            if (activeFontBtn) activeFontBtn.style.borderColor = '#00f0ff';
        }
    }

    function createThemeToggle() {
        if (document.getElementById('zoi-theme-customizer')) return;

        // 1. The Floating Cog Button
        const btn = document.createElement('button');
        btn.id = 'zoi-theme-customizer';
        btn.title = 'Display Preferences';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: '99998',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'linear-gradient(135deg, rgba(26,11,54,0.9), rgba(10,3,20,0.95))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 30px rgba(0,240,255,0.2)',
        });
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:26px;color:#00f0ff;">palette</span>';
        
        btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1) rotate(15deg)');
        btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1) rotate(0deg)');

        // 2. The Settings Popup Modal
        const popup = document.createElement('div');
        popup.id = 'zoi-customizer-popup';
        Object.assign(popup.style, {
            position: 'fixed',
            bottom: '95px',
            left: '24px',
            zIndex: '99999',
            width: '320px',
            background: 'rgba(10, 3, 20, 0.85)',
            backdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderTop: '1px solid rgba(255,255,255,0.3)',
            borderLeft: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
            transform: 'translateY(20px) scale(0.95)',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        });

        // 3. Injecting Popup Content
        popup.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                <h3 style="margin:0;font-size:18px;font-weight:800;color:#fff;text-shadow:0 2px 10px rgba(0,240,255,0.3);">3D Aesthetic Engine</h3>
                <span class="material-symbols-outlined" style="color:#00f0ff;font-size:20px;">diamond</span>
            </div>
            
            <p style="margin:0 0 12px 0;font-size:11px;font-weight:800;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;">Immersive Themes</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
                <button class="theme-btn" data-theme="dark" style="position:relative;overflow:hidden;padding:16px 12px;border-radius:16px;background:linear-gradient(135deg, #1a0b36, #0a0314);color:#fff;border:2px solid transparent;cursor:pointer;font-weight:800;font-size:13px;transition:all 0.3s;box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);">
                    <div style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;background:#00f0ff;filter:blur(15px);border-radius:50%;"></div>
                    Neon Midnight
                </button>
                <button class="theme-btn" data-theme="light" style="position:relative;overflow:hidden;padding:16px 12px;border-radius:16px;background:linear-gradient(135deg, #ffffff, #f1f5f9);color:#0f172a;border:2px solid transparent;cursor:pointer;font-weight:800;font-size:13px;transition:all 0.3s;box-shadow:inset 0 1px 0 #fff, 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;background:#f59e0b;filter:blur(15px);border-radius:50%;"></div>
                    Clean Day
                </button>
                <button class="theme-btn" data-theme="sunset" style="position:relative;overflow:hidden;padding:16px 12px;border-radius:16px;background:linear-gradient(135deg, #2b0c0c, #1a0505);color:#fff;border:2px solid transparent;cursor:pointer;font-weight:800;font-size:13px;transition:all 0.3s;box-shadow:inset 0 1px 0 rgba(255,90,0,0.3);">
                    <div style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;background:#ff0055;filter:blur(15px);border-radius:50%;"></div>
                    Sunset Glow
                </button>
                <button class="theme-btn" data-theme="ocean" style="position:relative;overflow:hidden;padding:16px 12px;border-radius:16px;background:linear-gradient(135deg, #1e293b, #020617);color:#fff;border:2px solid transparent;cursor:pointer;font-weight:800;font-size:13px;transition:all 0.3s;box-shadow:inset 0 1px 0 rgba(56,189,248,0.3);">
                    <div style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;background:#0ea5e9;filter:blur(15px);border-radius:50%;"></div>
                    Ocean Depths
                </button>
            </div>

            <p style="margin:0 0 12px 0;font-size:11px;font-weight:800;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;">Premium Typography</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <button class="font-btn" data-font="manrope" style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.05);color:#fff;border:2px solid transparent;cursor:pointer;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;">Manrope</button>
                <button class="font-btn" data-font="inter" style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.05);color:#fff;border:2px solid transparent;cursor:pointer;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;transition:all 0.2s;">Inter</button>
                <button class="font-btn" data-font="outfit" style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.05);color:#fff;border:2px solid transparent;cursor:pointer;font-size:12px;font-weight:700;font-family:'Outfit',sans-serif;transition:all 0.2s;">Outfit</button>
                <button class="font-btn" data-font="poppins" style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.05);color:#fff;border:2px solid transparent;cursor:pointer;font-size:12px;font-weight:700;font-family:'Poppins',sans-serif;transition:all 0.2s;">Poppins</button>
            </div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(popup);

        // Events
        let isOpen = false;
        btn.addEventListener('click', () => {
            isOpen = !isOpen;
            if (isOpen) {
                popup.style.opacity = '1';
                popup.style.pointerEvents = 'auto';
                popup.style.transform = 'translateY(0) scale(1)';
                popup.style.background = htmlEl.classList.contains('dark') ? 'rgba(10, 3, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)';
                popup.style.border = htmlEl.classList.contains('dark') ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';
                popup.querySelector('h3').style.color = htmlEl.classList.contains('dark') ? '#ffffff' : '#0f172a';
                popup.querySelectorAll('.font-btn').forEach(fb => fb.style.color = htmlEl.classList.contains('dark') ? '#ffffff' : '#0f172a');
            } else {
                popup.style.opacity = '0';
                popup.style.pointerEvents = 'none';
                popup.style.transform = 'translateY(20px) scale(0.95)';
            }
        });

        // Theme Clicks
        popup.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.getAttribute('data-theme');
                setThemeMode(mode);
            });
        });

        // Font Clicks
        popup.querySelectorAll('.font-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const font = e.currentTarget.getAttribute('data-font');
                setFontFamily(font);
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (isOpen && !popup.contains(e.target) && !btn.contains(e.target)) {
                isOpen = false;
                popup.style.opacity = '0';
                popup.style.pointerEvents = 'none';
                popup.style.transform = 'translateY(20px) scale(0.95)';
            }
        });

        updateCustomizerUI();
    }

    // Expose globally
    window.ZoiTheme = {
        toggleTheme: function () { setThemeMode(htmlEl.classList.contains('dark') ? 'light' : 'dark'); },
        setTheme: setThemeMode,
        setFont: setFontFamily,
        getTheme: function () { return htmlEl.classList.contains('dark') ? 'dark' : 'light'; },
        getFont: function () { return localStorage.getItem(THEME_FONT_KEY) || 'manrope'; }
    };

    // ══════════════════════════════════════════════════════
    // 9. 3D EFFECTS AUTO-APPLIER (GLOBAL AESTHETIC)
    // ══════════════════════════════════════════════════════
    function applyGlobal3DEffects() {
        // Target main structural panels, widgets, and dynamic cards
        document.querySelectorAll('.rounded-2xl, .rounded-3xl, .glass-panel, .bg-card-dark, .bg-surface-dark, .bg-white, aside .rounded-xl, aside .bg-gradient-to-br, aside .bg-gradient-to-b').forEach(el => {
            // Filter out tiny UI elements or top-level containers
            if (el.clientWidth > 100 && !el.classList.contains('zoi-3d-layer') && !el.closest('header') && !el.closest('footer')) {
                el.classList.add('zoi-3d-layer');
                // Give inner images a parallax boost
                el.querySelectorAll('img, .bg-cover').forEach(img => {
                    img.classList.add('zoi-3d-image');
                });
            }
        });

        // Make buttons bouncy with 3D depth
        document.querySelectorAll('button.bg-primary, a.bg-primary, .bg-gradient-to-r, .hover\\:scale-105, aside a, nav a').forEach(btn => {
            if (!btn.classList.contains('zoi-3d-btn')) {
                btn.classList.add('zoi-3d-btn');
            }
        });
        
        // Add subtle floating to floating avatars and interactive badges
        document.querySelectorAll('.rounded-full.border.shadow-md, .rounded-full.shadow-lg, #zoi-ai-chat-btn, aside .rounded-full').forEach(el => {
            if (!el.classList.contains('zoi-3d-float') && el.clientWidth >= 30) {
                el.classList.add('zoi-3d-float');
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // INIT — Run all fixes
    // ══════════════════════════════════════════════════════
    function init() {
        patchInlineStyles();
        fixFooterLinks();
        syncNavigation();
        connectAdminPartnerLinks();
        ensureAIAssistant();
        createThemeToggle();
        
        // Apply 3D aesthetic immediately and queue a refresh for dynamic React/JS content
        applyGlobal3DEffects();
        setTimeout(applyGlobal3DEffects, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also run after a short delay to catch dynamically rendered content
    setTimeout(init, 1500);
})();

// -----------------------------------------------------------------------------
// PWA: Service Worker Registration & Push Notifications
// -----------------------------------------------------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(async reg => {
                console.log('ZoiEats PWA Service Worker registered:', reg.scope);
                
                // Prompt for Push Notifications on supported browsers
                if ('PushManager' in window && window.Notification && Notification.permission !== 'denied') {
                    try {
                        let sub = await reg.pushManager.getSubscription();
                        if (!sub) {
                            // Fetch VAPID public key from backend dynamically
                            const apiBase = (typeof ZOI_CONFIG !== 'undefined' ? ZOI_CONFIG.API_BASE_URL : 'http://localhost:5000/api');
                            const vapidRes = await fetch(apiBase + '/push/vapid-key');
                            if (!vapidRes.ok) {
                                console.log('Push notifications not configured on server, skipping.');
                                return;
                            }
                            const { publicKey } = await vapidRes.json();
                            
                            // Convert base64 VAPID key to Uint8Array
                            const urlBase64ToUint8Array = (base64String) => {
                                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                                const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                                const rawData = atob(base64);
                                return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
                            };

                            sub = await reg.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(publicKey)
                            });
                            
                            await fetch(apiBase + '/notifications/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(sub)
                            });
                            console.log('✅ Successfully enrolled in Push Notifications!');
                        }
                    } catch (e) { console.error('Push enrollment failed', e); }
                }
            })
            .catch(err => console.error('ZoiEats PWA Service Worker failed:', err));
    });
}

