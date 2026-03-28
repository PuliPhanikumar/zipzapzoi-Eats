/**
 * ZoiEats Global Location Detection
 * Auto-detects user's location using the browser's Geolocation API
 * and uses free Nominatim reverse geocoding to get the address.
 * 
 * Usage: Include this script on any page with a location button.
 * It auto-discovers location-related elements by looking for:
 *   - Elements containing 'location_on' material icon text
 *   - Buttons/elements with data-zoi-location attribute
 *   - The common readonly location input beside the icon
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'zoiUserLocation';
    const STORAGE_EXPIRY_KEY = 'zoiLocationExpiry';
    const EXPIRY_HOURS = 1; // Cache location for 1 hour

    // Get cached location if fresh
    function getCachedLocation() {
        try {
            const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
            if (expiry && Date.now() < parseInt(expiry)) {
                return localStorage.getItem(STORAGE_KEY);
            }
        } catch (e) {}
        return null;
    }

    // Cache location
    function setCachedLocation(locationStr) {
        try {
            localStorage.setItem(STORAGE_KEY, locationStr);
            localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + EXPIRY_HOURS * 3600000));
        } catch (e) {}
    }

    // Find all location display elements on the page
    function findLocationElements() {
        const elements = [];

        // 1. Find readonly inputs near location_on icons
        document.querySelectorAll('input[readonly]').forEach(input => {
            const parent = input.closest('div');
            if (parent && parent.innerHTML.includes('location_on')) {
                elements.push({ type: 'input', el: input, container: parent.closest('button, div') });
            }
        });

        // 2. Find buttons containing "location" text and location_on icon
        document.querySelectorAll('button, [data-zoi-location]').forEach(btn => {
            if (btn.innerHTML.includes('location_on') && !btn.querySelector('input')) {
                const spanEl = Array.from(btn.querySelectorAll('span')).find(s => 
                    !s.classList.contains('material-symbols-outlined') && 
                    !s.innerText.includes('location_on')
                );
                if (spanEl) {
                    elements.push({ type: 'span', el: spanEl, container: btn });
                }
            }
        });

        // 3. Find location divs in header with Bengaluru/Delhi/Connaught
        document.querySelectorAll('span, p').forEach(span => {
            const t = span.innerText.trim();
            if ((t.includes('Bengaluru') || t.includes('New Delhi') || t.includes('Connaught') || t.includes('Detecting')) && 
                span.closest('button, header, nav')) {
                const parent = span.closest('button') || span.closest('div');
                if (parent && parent.innerHTML.includes('location_on')) {
                    elements.push({ type: 'span', el: span, container: parent });
                }
            }
        });

        return elements;
    }

    // Update all location elements on the page
    function updateLocationDisplay(locationStr) {
        const locationEls = findLocationElements();
        locationEls.forEach(item => {
            if (item.type === 'input') {
                item.el.value = locationStr;
            } else if (item.type === 'span') {
                item.el.innerText = locationStr;
            }
        });
    }

    // Reverse geocode coordinates to address
    async function reverseGeocode(lat, lon) {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            const data = await resp.json();
            if (data && data.address) {
                const a = data.address;
                // Build a short, readable address
                const parts = [];
                if (a.neighbourhood || a.suburb) parts.push(a.neighbourhood || a.suburb);
                if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
                if (a.state) parts.push(a.state);
                return parts.slice(0, 2).join(', ') || data.display_name.split(',').slice(0, 2).join(',');
            }
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        } catch (e) {
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
    }

    // Request location from browser
    function requestLocation() {
        if (!navigator.geolocation) {
            updateLocationDisplay('Location unavailable');
            return;
        }

        updateLocationDisplay('Detecting...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const locationStr = await reverseGeocode(latitude, longitude);
                setCachedLocation(locationStr);
                updateLocationDisplay(locationStr);
            },
            (error) => {
                console.warn('Location error:', error.message);
                let fallback = 'Bengaluru';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        fallback = 'Enable Location';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        fallback = 'Location unavailable';
                        break;
                    case error.TIMEOUT:
                        fallback = 'Location timed out';
                        break;
                }
                updateLocationDisplay(fallback);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
        );
    }

    // Initialize on DOM ready
    function init() {
        // Check for cached location first
        const cached = getCachedLocation();
        if (cached) {
            updateLocationDisplay(cached);
        }

        // Attach click handlers to location buttons
        const locationEls = findLocationElements();
        const containers = new Set();
        locationEls.forEach(item => {
            if (item.container && !containers.has(item.container)) {
                containers.add(item.container);
                item.container.style.cursor = 'pointer';
                item.container.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestLocation();
                });
            }
        });

        // Auto-detect on first visit (if no cache)
        if (!cached) {
            // Small delay to prevent blocking page render
            setTimeout(requestLocation, 1500);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
