/**
 * ZipZapZoi Eats - Restaurant Partner Engine
 * Handles business logic for all "Restaurant Partner" pages and synchronizes data
 * with the central db_simulation.js (Admin Console & Customer App).
 */

// Global constant to simulate the currently logged-in active restaurant.
// In a real app, this comes from JWT/Session.
const CURRENT_RESTAURANT_ID = "101"; // Spice Symphony (Demo Default)

// 1. ZoiPartnerAuth
window.ZoiPartnerAuth = {
    init: () => {
        // Enforce login on secured pages.
        // If not on login/registration/onboarding, require active session.
        const unauthPages = ['restaurant partner registration.html', 'restaurant partner onboarding.html', 'restaurant pricing plans.html'];
        const currentPage = window.location.pathname.split('/').pop().replace('%20', ' ');

        let session = localStorage.getItem('zoiPartnerSession');
        if (!session && !unauthPages.includes(currentPage)) {
            // Uncomment in production: window.location.href = 'restaurant partner registration.html';
        }
    },
    login: (id) => {
        localStorage.setItem('zoiPartnerSession', id);
        return true;
    },
    logout: () => {
        localStorage.removeItem('zoiPartnerSession');
        localStorage.removeItem('zoiPOSSession');
        localStorage.removeItem('zoiHostelSession');

        // Check if legacy zoiUser holds a partner/pos session
        try {
            const legacyUser = JSON.parse(localStorage.getItem('zoiUser') || 'null');
            if (legacyUser && ['partner', 'pos_staff', 'hostel'].includes(legacyUser.type || legacyUser.role)) {
                localStorage.removeItem('zoiUser');
            }
        } catch(e) {}

        // Route to login page based on current context
        const currentPage = window.location.pathname.toLowerCase();
        if (currentPage.includes('pos')) {
            window.location.href = 'login & registration.html';
        } else {
            window.location.href = 'restaurant partner registration.html';
        }
    }
};

// 2. ZoiPartnerOnboarding (Sync to Admin Console)
window.ZoiPartnerOnboarding = {
    submitApplication: (applicationData) => {
        // Grab existing applications from ZoiRestaurants or fallback to localStorage key
        let apps = [];
        try {
            if (typeof ZoiRestaurants !== 'undefined') {
                apps = ZoiRestaurants.getApplications();
            } else {
                apps = JSON.parse(localStorage.getItem('zoiRestaurantApps') || '[]');
            }
        } catch (e) {
            apps = JSON.parse(localStorage.getItem('zoiRestaurantApps') || '[]');
        }

        const newApp = {
            id: 'REQ-' + Math.floor(1000 + Math.random() * 9000),
            name: applicationData.name,
            owner: applicationData.owner || 'Pending',
            phone: applicationData.phone || '+91 0000000000',
            zone: applicationData.zone || 'Default Zone',
            isPosOnly: applicationData.isPosOnly || false,
            docs: {
                fssai: !!applicationData.fssai,
                gst: !!applicationData.gst,
                bank: 'pending'
            },
            status: 'Pending',
            plan: applicationData.plan || 'yearly',
            submittedAt: new Date().toISOString()
        };

        apps.unshift(newApp);

        // Save back to local storage so Admin verification queue sees it
        if (typeof ZoiRestaurants !== 'undefined') {
            ZoiRestaurants.saveApplication(newApp);
        } else {
            localStorage.setItem('zoiRestaurantApps', JSON.stringify(apps));
        }

        console.log("Restaurant Application Submitted:", newApp);
        return newApp;
    }
};

// 3. ZoiPartnerMenu (CRUD Sync to Customer App)
window.ZoiPartnerMenu = {
    getAllCategories: () => {
        if (typeof DB_MENUS !== 'undefined') {
            return Object.keys(DB_MENUS[CURRENT_RESTAURANT_ID] || {});
        }
        return ['Recommended', 'Mains', 'Desserts', 'Beverages'];
    },
    getMenuItems: (categoryId = null) => {
        let menu = {};
        if (typeof DB_MENUS !== 'undefined') {
            menu = DB_MENUS[CURRENT_RESTAURANT_ID] || {};
            // Also merge from localStorage to keep state
            const localOverrides = JSON.parse(localStorage.getItem('zoiMenus') || '{}')[CURRENT_RESTAURANT_ID] || {};
            for (const cat in localOverrides) {
                if (!menu[cat]) menu[cat] = [];
                menu[cat] = [...localOverrides[cat], ...menu[cat].filter(m => !localOverrides[cat].find(l => l.id === m.id))];
            }
        } else {
            menu = JSON.parse(localStorage.getItem('zoiMenus') || '{}')[CURRENT_RESTAURANT_ID] || {};
        }

        if (categoryId) {
            return menu[categoryId] || [];
        }

        // Return flattened list
        let allItems = [];
        for (const cat in menu) {
            allItems = allItems.concat(menu[cat]);
        }
        return allItems;
    },
    addMenuItem: (itemData, categoryId = 'Recommended') => {
        let menus = {};
        if (typeof DB_MENUS !== 'undefined') {
            // Store new items into localStorage overrides
            menus = JSON.parse(localStorage.getItem('zoiMenus') || '{}');
            if (!menus[CURRENT_RESTAURANT_ID]) menus[CURRENT_RESTAURANT_ID] = {};
            if (!menus[CURRENT_RESTAURANT_ID][categoryId]) menus[CURRENT_RESTAURANT_ID][categoryId] = [];

            menus[CURRENT_RESTAURANT_ID][categoryId].unshift({
                id: itemData.id || "M" + Math.floor(Math.random() * 90000),
                name: itemData.name,
                price: itemData.price,
                desc: itemData.desc || 'A delicious new addition.',
                tags: itemData.tags || ['Bestseller'],
                veg: itemData.veg !== undefined ? itemData.veg : true,
                image: itemData.image || "https://via.placeholder.com/150",
                customizable: !!itemData.customizable
            });

            localStorage.setItem('zoiMenus', JSON.stringify(menus));
            return true;
        }
        return false;
    },
    deleteMenuItem: (itemId) => {
        if (typeof DB_MENUS !== 'undefined') {
            let menus = JSON.parse(localStorage.getItem('zoiMenus') || '{}');
            let restMenu = menus[CURRENT_RESTAURANT_ID];
            if (!restMenu) return;

            for (const cat in restMenu) {
                restMenu[cat] = restMenu[cat].filter(i => i.id != itemId);
            }
            localStorage.setItem('zoiMenus', JSON.stringify(menus));
            return true;
        }
        return false;
    },
    toggleItemStock: (itemId) => {
        if (typeof DB_MENUS !== 'undefined') {
            let menus = JSON.parse(localStorage.getItem('zoiMenus') || '{}');
            let restMenu = menus[CURRENT_RESTAURANT_ID];
            if (!restMenu) return;

            let found = false;
            for (const cat in restMenu) {
                for (let i = 0; i < restMenu[cat].length; i++) {
                    if (restMenu[cat][i].id == itemId) {
                        let tags = restMenu[cat][i].tags || [];
                        if (tags.includes('Out of Stock')) {
                            restMenu[cat][i].tags = tags.filter(t => t !== 'Out of Stock');
                        } else {
                            restMenu[cat][i].tags.push('Out of Stock');
                        }
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            localStorage.setItem('zoiMenus', JSON.stringify(menus));
            return true;
        }
        return false;
    }
};

// 4. ZoiPartnerOrders (KDS & Live Orders sync with Customer/Admin)
window.ZoiPartnerOrders = {
    getLiveOrders: () => {
        // Live orders are those in `zoiOrderHistory` that are NOT "Delivered" or "Cancelled"
        // and belong to this restaurant.
        let allOrders = JSON.parse(localStorage.getItem('zoiOrderHistory') || '[]');

        return allOrders.filter(o =>
            o.restaurantId === CURRENT_RESTAURANT_ID &&
            ['Pending', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)
        );
    },
    getPastOrders: () => {
        // For Dashboard history
        let allOrders = JSON.parse(localStorage.getItem('zoiOrderHistory') || '[]');
        return allOrders.filter(o =>
            o.restaurantId === CURRENT_RESTAURANT_ID &&
            ['Delivered', 'Cancelled'].includes(o.status)
        );
    },
    updateOrderStatus: (orderId, newStatus) => {
        let allOrders = JSON.parse(localStorage.getItem('zoiOrderHistory') || '[]');
        let adminOrders = JSON.parse(localStorage.getItem('zoiCompletedOrders') || '[]');

        let orderFound = false;

        // 1. Update Customer live tracking DB
        for (let i = 0; i < allOrders.length; i++) {
            if (allOrders[i].id === orderId) {
                allOrders[i].status = newStatus;

                // Add tracking timestamp
                if (!allOrders[i].tracking) allOrders[i].tracking = [];
                allOrders[i].tracking.push({
                    status: newStatus,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    desc: `Order is now ${newStatus}`
                });

                orderFound = true;
                break;
            }
        }

        // 2. Update Admin completed orders DB if status is Delivered or Cancelled
        if (orderFound && ['Delivered', 'Cancelled'].includes(newStatus)) {
            const orderObj = allOrders.find(o => o.id === orderId);
            // Push to admin
            const adminOrder = {
                id: orderObj.id,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString(),
                user: "Guest Customer",
                restaurant: "Spice Symphony",
                items: orderObj.items ? orderObj.items.length : 1,
                total: orderObj.total,
                status: newStatus,
                zone: "Indiranagar",
                rating: 0
            };

            const existingIndex = adminOrders.findIndex(o => o.id === orderId);
            if (existingIndex > -1) adminOrders[existingIndex] = adminOrder;
            else adminOrders.unshift(adminOrder);

            localStorage.setItem('zoiCompletedOrders', JSON.stringify(adminOrders));
        }

        // Save back to customer
        localStorage.setItem('zoiOrderHistory', JSON.stringify(allOrders));

        // Alert sync event for UI components listening
        document.dispatchEvent(new CustomEvent('zoiOrderUpdated', { detail: { orderId, status: newStatus } }));
        return true;
    }
};

// 5. ZoiPartnerDashboard (Metrics calculation)
window.ZoiPartnerDashboard = {
    getMetrics: () => {
        let todaysOrders = ZoiPartnerOrders.getPastOrders().filter(o => o.date === new Date().toISOString().split('T')[0]);
        let live = ZoiPartnerOrders.getLiveOrders();

        let revenue = todaysOrders.reduce((acc, curr) => acc + parseFloat(curr.total || 0), 0);

        return {
            liveOrders: live.length,
            completedToday: todaysOrders.length,
            revenueToday: revenue,
            averageRating: 4.8 // Mock
        };
    }
};

// 6. ZoiRestaurantSync (POS, KDS, & Table Management Sync)
window.ZoiRestaurantSync = {
    // 1. Listeners
    listen: (callback) => {
        window.addEventListener('storage', (e) => {
            if (e.key === 'zoiKDS_' + CURRENT_RESTAURANT_ID || e.key === '_zoiSyncEvent') {
                callback({ type: 'KDS_UPDATED', restId: CURRENT_RESTAURANT_ID });
            }
            if (e.key === 'zoiTabs_' + CURRENT_RESTAURANT_ID) {
                callback({ type: 'TABS_UPDATED', restId: CURRENT_RESTAURANT_ID });
            }
        });
        document.addEventListener('zoiSyncEvent', (e) => callback(e.detail));
    },

    // 2. Tabs Management (Table Management & POS)
    getActiveTabs: (restId) => {
        return JSON.parse(localStorage.getItem(`zoiTabs_${restId}`) || '[]');
    },
    removeTab: (restId, tabId) => {
        let tabs = ZoiRestaurantSync.getActiveTabs(restId);
        tabs = tabs.filter(t => t.id !== tabId);
        localStorage.setItem(`zoiTabs_${restId}`, JSON.stringify(tabs));
        ZoiRestaurantSync._triggerSync('TABS_UPDATED', restId);
    },
    addOrUpdateTab: (restId, tabData) => {
        let tabs = ZoiRestaurantSync.getActiveTabs(restId);
        const idx = tabs.findIndex(t => t.id === tabData.id);
        if (idx > -1) {
            tabs[idx] = { ...tabs[idx], ...tabData };
        } else {
            tabs.push(tabData);
        }
        localStorage.setItem(`zoiTabs_${restId}`, JSON.stringify(tabs));
        ZoiRestaurantSync._triggerSync('TABS_UPDATED', restId);
    },

    // 3. KDS Sync
    getKDSTickets: (restId) => {
        return JSON.parse(localStorage.getItem(`zoiKDS_${restId}`) || '[]');
    },
    publishKDS: (restId, ticket) => {
        let tickets = ZoiRestaurantSync.getKDSTickets(restId);
        const idx = tickets.findIndex(t => t.id === ticket.id);
        if (idx > -1) {
            tickets[idx] = { ...tickets[idx], ...ticket };
        } else {
            tickets.push(ticket);
        }
        localStorage.setItem(`zoiKDS_${restId}`, JSON.stringify(tickets));
        ZoiRestaurantSync._triggerSync('KDS_UPDATED', restId);
    },
    removeKDSTicket: (restId, ticketId) => {
        let tickets = ZoiRestaurantSync.getKDSTickets(restId);
        tickets = tickets.filter(t => t.id !== ticketId);
        localStorage.setItem(`zoiKDS_${restId}`, JSON.stringify(tickets));
        ZoiRestaurantSync._triggerSync('KDS_UPDATED', restId);
    },

    // 4. POS History
    getOrderHistory: (restId) => {
        return JSON.parse(localStorage.getItem(`zoiPosHistory_${restId}`) || '[]');
    },
    archiveToHistory: (restId, orderData) => {
        let history = ZoiRestaurantSync.getOrderHistory(restId);
        const newOrder = {
            ...orderData,
            archivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toISOString().split('T')[0]
        };
        history.unshift(newOrder);
        localStorage.setItem(`zoiPosHistory_${restId}`, JSON.stringify(history));

        // Sync POS order to Admin Completed Orders Database
        let adminOrders = JSON.parse(localStorage.getItem('zoiCompletedOrders') || '[]');
        const adminOrder = {
            id: newOrder.id,
            date: newOrder.date,
            time: newOrder.archivedAt,
            user: "POS Walk-in",
            restaurant: "Spice Symphony",
            items: newOrder.items ? newOrder.items.length : 1,
            total: newOrder.total,
            status: 'Delivered',
            zone: "Indiranagar",
            rating: 0
        };
        adminOrders.unshift(adminOrder);
        localStorage.setItem('zoiCompletedOrders', JSON.stringify(adminOrders));

        ZoiRestaurantSync._triggerSync('HISTORY_UPDATED', restId);
    },

    // 5. Internal Helper
    _triggerSync: (type, restId) => {
        localStorage.setItem('_zoiSyncEvent', Date.now().toString());
        document.dispatchEvent(new CustomEvent('zoiSyncEvent', { detail: { type, restId } }));
    }
};

// 7. ZoiStaff (for POS Shift Management)
window.ZoiStaff = {
    getStaffStats: (restId) => {
        let history = ZoiRestaurantSync.getOrderHistory(restId);
        let today = new Date().toISOString().split('T')[0];
        let todayHistory = history.filter(h => h.date === today || !h.date);

        let stats = {};
        todayHistory.forEach(h => {
            const sName = h.staff || 'POS User';
            if (!stats[sName]) {
                stats[sName] = { orderCount: 0, cashCollected: 0, upiCollected: 0, cardCollected: 0, salesTotal: 0 };
            }
            stats[sName].orderCount++;
            let amt = parseFloat(h.total.toString().replace(/[^0-9.-]+/g, "")) || 0;
            stats[sName].salesTotal += amt;

            if (h.paymentMethod === 'Cash') stats[sName].cashCollected += amt;
            else if (h.paymentMethod === 'UPI') stats[sName].upiCollected += amt;
            else if (h.paymentMethod === 'Card') stats[sName].cardCollected += amt;
        });
        return stats;
    },
    endShift: (restId, staffName) => {
        console.log(`Shift ended for ${staffName} at ${restId}`);
    }
};

// Initialize Auth
ZoiPartnerAuth.init();
