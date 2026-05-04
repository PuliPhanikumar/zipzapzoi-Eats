/**
 * ZoiEats PWA Registration, Update Manager & Smart Install Banner
 * Include this script on every page before </body>
 */
(function() {
    'use strict';
    if (!('serviceWorker' in navigator)) return;

    // Register SW
    navigator.serviceWorker.register('/sw.js')
        .then(reg => {
            console.log('[PWA] Service Worker registered, scope:', reg.scope);

            // Detect updates
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast();
                    }
                });
            });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));

    // Refresh on controller change (new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
    });

    // Update toast
    function showUpdateToast() {
        if (document.getElementById('pwa-update-toast')) return;
        const toast = document.createElement('div');
        toast.id = 'pwa-update-toast';
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#1a0b36;border:1px solid #00f0ff;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 30px rgba(0,240,255,0.3);';
        toast.innerHTML = '<span style="color:#00f0ff">⚡</span> New version available! <button onclick="location.reload()" style="background:#00f0ff;color:#0a0314;border:none;padding:6px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px">Update</button>';
        document.body.appendChild(toast);
    }

    // ═══════════════════════════════════════════
    // INSTALL PROMPT — Smart Banner (2nd visit, 7-day dismiss)
    // ═══════════════════════════════════════════
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        window.zoiInstallPWA = triggerInstall;

        // Only show on 2nd+ visit
        const visits = parseInt(localStorage.getItem('zoiVisitCount') || '0') + 1;
        localStorage.setItem('zoiVisitCount', String(visits));

        if (visits < 2) return;

        // 7-day dismiss cooldown
        const dismissed = localStorage.getItem('zoiInstallDismissed');
        if (dismissed && (Date.now() - parseInt(dismissed)) < 7 * 86400000) return;

        // Don't show on admin/partner pages
        if (location.pathname.includes('admin') || location.pathname.includes('partner')) return;

        setTimeout(() => showInstallBanner(), 3000);
    });

    function triggerInstall() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
            console.log('[PWA] Install:', choice.outcome);
            deferredPrompt = null;
            hideInstallBanner();
        });
    }

    function showInstallBanner() {
        if (document.getElementById('zoi-install-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'zoi-install-banner';
        banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99998;background:linear-gradient(135deg,#1a0b36,#0a0314);border-top:1px solid #00f0ff;padding:16px 20px;display:flex;align-items:center;gap:16px;font-family:sans-serif;box-shadow:0 -8px 30px rgba(0,0,0,0.5);animation:slideUp .4s ease-out;';
        banner.innerHTML = `
            <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,rgba(0,240,255,0.2),rgba(255,0,255,0.15));display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🍕</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px">Install ZoiEats</div>
                <div style="font-size:12px;color:#b4a5d8">Add to home screen for the best experience — fast, offline-ready!</div>
            </div>
            <button id="zoi-install-btn" style="background:#00f0ff;color:#0a0314;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap">Install</button>
            <button id="zoi-install-dismiss" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>
        `;
        // Add animation keyframe
        if (!document.getElementById('zoi-install-styles')) {
            const style = document.createElement('style');
            style.id = 'zoi-install-styles';
            style.textContent = '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}';
            document.head.appendChild(style);
        }
        document.body.appendChild(banner);

        document.getElementById('zoi-install-btn').addEventListener('click', triggerInstall);
        document.getElementById('zoi-install-dismiss').addEventListener('click', () => {
            localStorage.setItem('zoiInstallDismissed', String(Date.now()));
            hideInstallBanner();
        });
    }

    function hideInstallBanner() {
        const b = document.getElementById('zoi-install-banner');
        if (b) { b.style.animation = 'slideUp .3s ease-in reverse forwards'; setTimeout(() => b.remove(), 300); }
    }

    // ═══════════════════════════════════════════
    // iOS DETECTION — Show manual instructions
    // ═══════════════════════════════════════════
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    if (isIOS && !isStandalone) {
        const visits = parseInt(localStorage.getItem('zoiVisitCount') || '0') + 1;
        localStorage.setItem('zoiVisitCount', String(visits));

        if (visits >= 2) {
            const dismissed = localStorage.getItem('zoiIOSDismissed');
            if (!dismissed || (Date.now() - parseInt(dismissed)) > 14 * 86400000) {
                setTimeout(() => showIOSBanner(), 4000);
            }
        }
    }

    function showIOSBanner() {
        if (document.getElementById('zoi-ios-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'zoi-ios-banner';
        banner.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:99998;background:#1a0b36;border:1px solid rgba(0,240,255,0.3);border-radius:16px;padding:16px 20px;font-family:sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.5);animation:slideUp .4s ease-out;';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <span style="font-size:24px">📲</span>
                <div style="font-size:14px;font-weight:700;color:#fff">Install ZoiEats on your iPhone</div>
                <button onclick="localStorage.setItem('zoiIOSDismissed',Date.now());this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#666;font-size:18px;cursor:pointer">✕</button>
            </div>
            <div style="font-size:12px;color:#b4a5d8;line-height:1.6">
                Tap <span style="display:inline-flex;align-items:center;gap:3px;background:rgba(0,240,255,0.1);padding:2px 8px;border-radius:6px;color:#00f0ff;font-weight:600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2"><path d="M12 5v14M5 12l7-7 7 7"/><path d="M5 19h14"/></svg> Share</span> 
                then <span style="background:rgba(0,240,255,0.1);padding:2px 8px;border-radius:6px;color:#00f0ff;font-weight:600">Add to Home Screen</span>
            </div>
        `;
        document.body.appendChild(banner);
    }

    // ═══════════════════════════════════════════
    // ONLINE/OFFLINE STATUS EVENTS
    // ═══════════════════════════════════════════
    window.addEventListener('online', () => {
        const offBanner = document.getElementById('zoi-offline-bar');
        if (offBanner) offBanner.remove();
    });

    window.addEventListener('offline', () => {
        if (document.getElementById('zoi-offline-bar')) return;
        const bar = document.createElement('div');
        bar.id = 'zoi-offline-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;text-align:center;padding:8px;font-family:sans-serif;font-size:13px;font-weight:600;animation:slideDown .3s ease-out';
        bar.innerHTML = '📡 You\'re offline — Some features may not work';
        if (!document.getElementById('zoi-offline-styles')) {
            const s = document.createElement('style');
            s.id = 'zoi-offline-styles';
            s.textContent = '@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
            document.head.appendChild(s);
        }
        document.body.prepend(bar);
    });
})();
