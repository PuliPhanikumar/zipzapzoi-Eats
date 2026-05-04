/**
 * ZoiEats PWA Registration & Update Manager
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

    // Install prompt handler
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        // Expose globally for custom install buttons
        window.zoiInstallPWA = () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(choice => {
                console.log('[PWA] Install:', choice.outcome);
                deferredPrompt = null;
            });
        };
    });
})();
