/**
 * ZipZapZoi Eats - Database Simulation ("The Brain")
 * This file acts as a centralized mock database.
 * It stores Restaurants, Menus, Users, and Order History.
 */

// 1. MOCK USERS & INTERNAL STAFF
const MOCK_USERS = {
    customer: { name: "Aditi Rao", email: "aditi@example.com", type: "customer", points: 2450 },
    partner: { name: "Spice Symphony Manager", email: "partner@zipzapzoi.com", type: "partner", id: "101" },
    rider: { name: "Ravi Kumar", phone: "9876543210", type: "rider", vehicle: "Electric Scooter" }
};

const DB_STAFF = [
    { id: "EMP-001", name: "Siddharth Menon", role: "Super Admin", email: "sid.admin@zipzapzoi.com", status: "Active" },
    { id: "EMP-042", name: "Kavya Patel", role: "Dispute Manager", email: "kavya.p@zipzapzoi.com", status: "Active" },
    { id: "EMP-089", name: "Aryan Singh", role: "Zone Supervisor", email: "aryan.s@zipzapzoi.com", status: "Active" },
    { id: "EMP-103", name: "Neha Gupta", role: "Support Agent", email: "neha.g@zipzapzoi.com", status: "Active" }
];

const ZoiStaff = {
    init: () => {
        if (!localStorage.getItem('zoiStaff')) {
            localStorage.setItem('zoiStaff', JSON.stringify(DB_STAFF));
        }
    },
    getAll: () => JSON.parse(localStorage.getItem('zoiStaff')) || [],
    updateRole: (id, newRole) => {
        const staff = ZoiStaff.getAll();
        const emp = staff.find(s => s.id === id);
        if (emp) {
            emp.role = newRole;
            localStorage.setItem('zoiStaff', JSON.stringify(staff));
            return emp;
        }
        return null;
    }
};
ZoiStaff.init();

// --- AUTH METRICS AND ROLE MATRIX ---
const ROLE_ACCESS_MATRIX = {
    'Super Admin': ['all'],
    'Dispute Manager': ['Manager Dashboard', 'Dispute Resolution'],
    'Zone Supervisor': ['Manager Dashboard', 'Zone Logistics'],
    'Support Agent': ['Manager Dashboard', 'Dispute Resolution']
};

const ZoiAuth = {
    init: () => {
        // Default login is Super Admin if none exists
        if (!localStorage.getItem('zoiCurrentUser')) {
            const allStaff = ZoiStaff.getAll();
            const superAdmin = allStaff.find(s => s.role === 'Super Admin') || { id: 'EMP-000', name: 'Admin', role: 'Super Admin' };
            localStorage.setItem('zoiCurrentUser', JSON.stringify(superAdmin));
        }
    },
    getCurrentUser: () => JSON.parse(localStorage.getItem('zoiCurrentUser')),
    setCurrentUser: (empId) => {
        const staff = ZoiStaff.getAll();
        const emp = staff.find(s => s.id === empId);
        if (emp) {
            localStorage.setItem('zoiCurrentUser', JSON.stringify(emp));
            return true;
        }
        return false;
    },
    enforceAccess: (pageName) => {
        ZoiAuth.init();
        const user = ZoiAuth.getCurrentUser();
        if (!user || !user.role) window.location.href = 'admin 403.html';

        const allowedPages = ROLE_ACCESS_MATRIX[user.role] || [];
        if (!allowedPages.includes('all') && !allowedPages.includes(pageName)) {
            window.location.href = 'admin 403.html';
        }
    },
    renderSwitcher: () => {
        const container = document.getElementById('sim-login-container');
        if (!container) return;

        const allStaff = ZoiStaff.getAll();
        const currentUser = ZoiAuth.getCurrentUser();

        let optionsHtml = allStaff.map(emp =>
            `<option value="${emp.id}" ${currentUser && currentUser.id === emp.id ? 'selected' : ''}>${emp.name} (${emp.role})</option>`
        ).join('');

        container.innerHTML = `
            <label class="text-[10px] text-primary/80 uppercase font-bold mb-1 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">engineering</span> Simulate Login</label>
            <select onchange="ZoiAuth.switchUser(this.value)" class="w-full bg-black/50 border border-primary/30 rounded text-xs text-white p-1.5 focus:border-primary cursor-pointer">
                ${optionsHtml}
            </select>
        `;
    },
    switchUser: (empId) => {
        if (ZoiAuth.setCurrentUser(empId)) {
            window.location.reload();
        }
    },
    applySidebarRBAC: () => {
        // Automatically hide sidebar links based on the current user's role
        const user = ZoiAuth.getCurrentUser();
        if (!user || user.role === 'Super Admin') return;

        const allowedPages = ROLE_ACCESS_MATRIX[user.role] || [];
        const links = document.querySelectorAll('aside a');

        links.forEach(link => {
            const linkText = link.innerText.trim();
            // Don't hide logout or Manager Dashboard
            if (linkText.includes('Logout') || linkText.includes('Manager Dashboard')) return;

            // If the link text isn't explicitly in the allowed pages matrix, hide it.
            let isAllowed = false;
            allowedPages.forEach(allowed => {
                if (linkText.includes(allowed.split(' ')[0])) isAllowed = true;
            });

            if (!isAllowed) {
                link.style.display = 'none';
            }
        });
    },
    logout: () => {
        localStorage.removeItem('zoiCurrentUser');
        // Clear session specific to admin if any
        localStorage.removeItem('zoiAdminSession');
        
        try {
            const legacyUser = JSON.parse(localStorage.getItem('zoiUser') || 'null');
            if (legacyUser && (legacyUser.type === 'admin' || legacyUser.role === 'Super Admin')) {
                localStorage.removeItem('zoiUser');
            }
        } catch(e) {}

        window.location.href = 'login & registration.html';
    }
};
ZoiAuth.init();

document.addEventListener('DOMContentLoaded', () => {
    ZoiAuth.renderSwitcher();
    ZoiAuth.applySidebarRBAC();
});

// ─── ZONES DATA (Backend-Synced) ────────────────────────
const DEFAULT_ZONES = [
    { id: 1, name: "Connaught Place", lat: 28.6315, lng: 77.2167, radius: 1500, surge: 1.2, active: true, orders: 87, riders: 12 },
    { id: 2, name: "South Delhi", lat: 28.5355, lng: 77.2500, radius: 2000, surge: 1.0, active: true, orders: 134, riders: 18 },
    { id: 3, name: "Indiranagar", lat: 12.9716, lng: 77.6412, radius: 1800, surge: 1.5, active: true, orders: 210, riders: 25 },
    { id: 4, name: "Koramangala", lat: 12.9352, lng: 77.6245, radius: 1600, surge: 1.0, active: true, orders: 178, riders: 20 },
    { id: 5, name: "HSR Layout", lat: 12.9116, lng: 77.6474, radius: 1400, surge: 1.3, active: true, orders: 95, riders: 14 }
];

const ZoiZones = {
    _key: 'zoiZones',
    init: () => {
        if (!localStorage.getItem(ZoiZones._key)) {
            localStorage.setItem(ZoiZones._key, JSON.stringify(DEFAULT_ZONES));
        }
        // Async sync from backend
        ZoiZones.syncFromBackend();
    },
    syncFromBackend: async () => {
        try {
            if (typeof zoiApiSilent === 'undefined') return;
            const res = await zoiApiSilent('/zones');
            if (res && res.ok) {
                const backendZones = await res.json();
                if (Array.isArray(backendZones) && backendZones.length > 0) {
                    const mapped = backendZones.map((z, i) => ({
                        id: z.id,
                        name: z.name,
                        lat: z.lat,
                        lng: z.lng,
                        radius: z.radius || 1500,
                        surge: z.surge || 1.0,
                        active: z.active !== false,
                        orders: z.orders || Math.floor(Math.random() * 200),
                        riders: z.riders || Math.floor(Math.random() * 30)
                    }));
                    localStorage.setItem(ZoiZones._key, JSON.stringify(mapped));
                }
            }
        } catch (e) { /* silent fallback */ }
    },
    getAll: () => JSON.parse(localStorage.getItem(ZoiZones._key)) || DEFAULT_ZONES,
    save: (zone) => {
        const all = ZoiZones.getAll();
        const idx = all.findIndex(z => z.id === zone.id);
        if (idx >= 0) all[idx] = zone;
        else all.push(zone);
        localStorage.setItem(ZoiZones._key, JSON.stringify(all));
        // Try to sync to backend
        if (typeof zoiApi !== 'undefined') {
            zoiApi('/zones', { method: idx >= 0 ? 'PUT' : 'POST', body: JSON.stringify(zone) }).catch(() => {});
        }
    },
    saveAll: (zones) => {
        localStorage.setItem(ZoiZones._key, JSON.stringify(zones));
    },
    delete: (id) => {
        const all = ZoiZones.getAll().filter(z => z.id !== id);
        localStorage.setItem(ZoiZones._key, JSON.stringify(all));
        if (typeof zoiApi !== 'undefined') {
            zoiApi(`/zones/${id}`, { method: 'DELETE' }).catch(() => {});
        }
    }
};
ZoiZones.init();

// 2. RESTAURANTS DATA
const DB_RESTAURANTS = [
    {
        id: "101",
        name: "Spice Symphony",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg",
        tags: ["North Indian", "Biryani", "Mughlai"],
        rating: 4.2,
        time: "25-30 min",
        cost: "₹350 for two",
        promoted: true,
        offer: "50% OFF up to ₹100"
    },
    {
        id: "102",
        name: "Burger King",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB4VXvyyWEULV09hPt7enBUBjv45obECCsipWD__eX4uf_uG3rX9uRcN4WdD-JK_YfxIibKF8jwq0wAyb1VTZJsYUQFT3JFiwMdq4cwGSOjrtVKAh5hE7tgdPZykdfnYL_cLRM-ajhKS9n8kuGD0J9v_mN4Y0jNB9qdiipwV2kDS1G502NKbrpd5ydJhQfvdJCg8NeluYSB_SG_ZbDfM4D9J-OHQ8tIJ3Ufwr4ywJRfJk2lXymKJ_I6hFVayazwwlWtsrYNGv0yAWI",
        tags: ["American", "Fast Food"],
        rating: 4.5,
        time: "15-20 min",
        cost: "₹250 for two",
        promoted: false,
        offer: "Free Delivery"
    },
    {
        id: "103",
        name: "Mainland China",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuACzqZTHOyUrwCaPY63CGdgnQKvsrdGFq45k-1oxFf_i0vk6SFb7PhdeOSh2r7sXrQKesyz5_9hZuW6hzjr4VfWTb0GHSI_f3ziTYU051b4ozq9VkHiKS3QLxbq_i442UnCFEfaH6Zt_gqdmI7VbVc8dFuOtMieJ_D_wtfzl2aUvuWe6-U8XIgiXU5lusRy7EoHH52rJxAi6jLwJHzeOTTb8Dl_txnkUbpDAdhvTmXZXCPvkNGXb65W3LTKda36sxAy7VI0bhlAXmg",
        tags: ["Asian", "Chinese", "Thai"],
        rating: 4.8,
        time: "35-40 min",
        cost: "₹1200 for two",
        promoted: false,
        offer: null
    },
    {
        id: "104",
        name: "La Pino'z Pizza",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrBr_Vl9zQLsmVatsZdkKvkWUJMVLTM-tv-jxDdtUJbz8hnP31qvsZDabXkYAiSqiZVfXWap8tc1Vmx-FlI-koVR5nh1WOEu7Y7uUkSKrSPHlDUSBPVWNE2Da2x5IF-081vD31RdPmULTi_toqfG6bs_T6n1I0B3YmNTp6MxPl1zFXnCgV_GpURdugB8jlKS5EAe5J9H9yXul75DSlTqEjdTgCydn28M9P875PAw8HByt5v0riWELtXF6-7GIlu4rOVEEyQiFJr1Q",
        tags: ["Pizza", "Pasta", "Italian"],
        rating: 3.9,
        time: "45 min",
        cost: "₹400 for two",
        promoted: false,
        offer: "Flat ₹125 OFF"
    },
    {
        id: "105",
        name: "Green Bowl",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB907FiH2ZUJGUn5iNmse6AvJj8rcRvkCGhLB5xm_XlNd-2ZBeSViFDTUQa9Wtig2yKOkOJGyyX15GcdK8E5BhPlS-M84SfNkvdNyW3WdN25ESOS5HX8F3Be26GblVUqYYC_qQSQc5XYHi0nXxkObQkLdNdDcqFZxD1rya2n5eqPZtfI_NYJBL0QI8PE67vyKkEr_YgUqWKfW81twsbX8yVmZvP8K8MMEkDlk-Yt6LrjzMLzECFIs8GKesTLCsYTz5CF6iZG_J0iDg",
        tags: ["Healthy", "Salads", "Juices"],
        rating: 4.6,
        time: "20-25 min",
        cost: "₹500 for two",
        promoted: false,
        offer: null
    },
    {
        id: "106",
        name: "Starbucks Coffee",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g",
        tags: ["Coffee", "Beverages", "Desserts"],
        rating: 4.4,
        time: "10-15 min",
        cost: "₹600 for two",
        promoted: false,
        offer: null
    },
    {
        id: "107",
        name: "Homestyle Dal Makhani",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A",
        tags: ["North Indian", "Punjabi", "Comfort Food"],
        rating: 4.7,
        time: "35 min",
        cost: "₹250 for two",
        promoted: true,
        offer: "Free Butter Naan on orders over ₹300"
    },
    {
        id: "108",
        name: "Crispy Masala Dosa",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl8",
        tags: ["South Indian", "Breakfast", "Healthy"],
        rating: 4.9,
        time: "20 mins",
        cost: "₹180 for two",
        promoted: true,
        offer: "Zap's Breakfast Pick"
    },
    {
        id: "109",
        name: "Spicy Hyderabadi Biryani",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5dhP82afCTOiEvPFGPkPq8mikHUWp_GYe6ld8PQjwT_FqCK-i9a3JWIMijmoW6kaSD2Dy-4KcQCKTzNA22KCBMiiCNVtewV2QukSo4_xqgwhWoIHXyO_laQ5IWE5swV7GY-dQ6pZ4I3UGGG1Ai6MnJiuiURgiHSK3NbH53OEVoi9Z-S0Ai2V1mADDDq94X-oSqNnrdkqoJZBL4mgXcKX16WskY-5YlLA2ubFV3g8xIr3xcKJ_4MVg9xTVlJYfJJvML7O9g8UFTbQ",
        tags: ["Biryani", "Mughlai", "Spicy"],
        rating: 4.8,
        time: "45 mins",
        cost: "₹350 for two",
        promoted: true,
        offer: "Trending Now"
    },
    {
        id: "110",
        name: "Burger Singh",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwotfShftcZoIivNfStqksPZZJq3_P3kHjJfr0sCHXE5LTbhzLKkOA_OJCxgUgKZYUPlfb5ChZGTRAE0NzF2UOAfgyfdMA_gUNP4Wu8XHtleuLAuJbijfsQCeOsRPFZDGcbJOegIrnbxZmyaaAA5_YEiMQvAJKiFmL8qiYtr9YlebrmcuskgcTzoDjxt73HAa_rZzkodOnwJvL9RbeIsKI4RAH3O2h46Q2zOqtKkAetikJFfifqu_7hb8j6ODL-ZlrApYzVMajKyI",
        tags: ["American", "Fast Food", "Burgers"],
        rating: 4.2,
        time: "25-30 min",
        cost: "\u20b9300 for two",
        promoted: true,
        offer: "60% OFF up to \u20b9120"
    },
    {
        id: "111",
        name: "Chaayos",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAl2Lb6xq-0tDopajUnW2cHR8TIOTEUEkV38RYgtmjKWnVYPl1BMsDLQhN4Ksp2NUT-4agVZt5PYoND8wd3RwRO0L4bcyWtMUa8NGLcPONnohVQmhmbDiiTSy-2pkTkTehFqwwZqD8gAe9a97PKQd1lpnBkVdpV2HW0wY3LGn-BEXUiBgtnTQJDb2hoJWYlrSxNBS6yDxaheWPuPtGoA0FCFOAxdJBYoPOaq3DTHr-j03pVm2WQAL04SHjxZmK7T9jfhxQOn9Tp-WQ",
        tags: ["Tea", "Snacks", "Indian"],
        rating: 4.5,
        time: "15-20 min",
        cost: "\u20b9200 for two",
        promoted: true,
        offer: "Buy 1 Get 1 Free"
    },
    {
        id: "112",
        name: "EatFit",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAVX1p4LizdXBSi-G7E-HSf4qKSUMWeii6BCBJaHQ9xTW302LVviSxj2k4FCj76DpShWPlBLH3wYX09FPwgvbf7J2QPvIfIb0_WmcQZch6eRTzZB0U3c5Zdvl7bU5isn2uvrmd24yLA7FcpBScSzKL74bhUxHJ7Se_xQJzmoPNhiaCLNLTUi4qBmS6goXyzp65ptPK712gq762qd5h60-w37hdB60sDIKv88vuluk2AgoS1nw9xsTGbq4YzTvfykD8Prkg9aEbav2Q",
        tags: ["Healthy", "Salads", "Thalis"],
        rating: 4.8,
        time: "20-25 min",
        cost: "\u20b9250 for two",
        promoted: false,
        offer: "Free delivery above \u20b9200"
    },
    {
        id: "113",
        name: "Mamagoto",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDIF4lMWRHYMebghYQVYy7kpHU-Wrn3WnbVNVhGa1fyi08tqRx8LQHhswKcvxc24fJDbhVSKUB9sEG9UpRWH3dhzbFHfGujNC40_EfpB04oxdUcmO6L2MpLM9R4XgDeywKmFdjGqPdWRj_C0YLpgbuy9X90g1X7qhjYQ7zI32vJ_krvG6qRNZbnbE2unz52MBnEajFmQH2tX9m-Sui7XvZfJ8yImX_lFk13mVMTGP9X357kD1FrfnU5ZVDdUzdSi802DvZvQbPJLHA",
        tags: ["Asian", "Ramen", "Sushi"],
        rating: 4.6,
        time: "35-40 min",
        cost: "\u20b9600 for two",
        promoted: true,
        offer: "50% OFF Deal of the Day"
    }
];

// 3. MENUS DATA
const DB_MENUS = {
    "101": [
        { id: 1, name: "Chicken Biryani", price: 350, desc: "Aromatic basmati rice with tender chicken.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A", spicy: true, veg: false, protein: true, nutrition: { cal: 520, protein: 32, carbs: 62, fat: 16, fiber: 3 } },
        { id: 2, name: "Paneer Tikka", price: 280, desc: "Cottage cheese marinated in yogurt and spices.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: false, veg: true, protein: true, nutrition: { cal: 350, protein: 22, carbs: 12, fat: 24, fiber: 2 } },
        { id: 3, name: "Butter Naan", price: 60, desc: "Soft clay oven bread with butter.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl80", spicy: false, veg: true, protein: false, nutrition: { cal: 260, protein: 7, carbs: 45, fat: 6, fiber: 2 } }
    ],
    "102": [ // Burger King
        { id: 201, name: "Whopper", price: 199, desc: "Flame-grilled beef patty with fresh veggies.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD34F9oKy1gC8C61C-lK4yJ-T6wY9x6gQ5yJ4E5B7n8rM9O0kP1q2s3t4u5v6w7x8y9z0A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0", spicy: false, veg: false, protein: true, nutrition: { cal: 660, protein: 28, carbs: 49, fat: 40, fiber: 2 } },
        { id: 202, name: "Chicken Fries", price: 149, desc: "Crispy chicken in the shape of fries.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD34F9oKy1gC8C61C-lK4yJ-T6wY9x6gQ5yJ4E5B7n8rM9O0kP1q2s3t4u5v6w7x8y9z0A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0", spicy: true, veg: false, protein: true, nutrition: { cal: 380, protein: 18, carbs: 28, fat: 22, fiber: 1 } },
        { id: 203, name: "Veggie Burger", price: 129, desc: "Crispy veggie patty with lettuce/mayo.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD34F9oKy1gC8C61C-lK4yJ-T6wY9x6gQ5yJ4E5B7n8rM9O0kP1q2s3t4u5v6w7x8y9z0A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0", spicy: false, veg: true, protein: false, nutrition: { cal: 420, protein: 12, carbs: 48, fat: 20, fiber: 4 } }
    ],
    "104": [ // La Pino'z
        { id: 401, name: "Cheesy 7 Pizza", price: 450, desc: "Overloaded with 7 types of liquid cheese.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD34F9oKy1gC8C61C-lK4yJ-T6wY9x6gQ5yJ4E5B7n8rM9O0kP1q2s3t4u5v6w7x8y9z0A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0", spicy: false, veg: true, protein: false, nutrition: { cal: 720, protein: 18, carbs: 78, fat: 38, fiber: 3 } },
        { id: 402, name: "Paneer Tikka Pizza", price: 380, desc: "Desi twist with spicy paneer chunks.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD34F9oKy1gC8C61C-lK4yJ-T6wY9x6gQ5yJ4E5B7n8rM9O0kP1q2s3t4u5v6w7x8y9z0A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0", spicy: true, veg: true, protein: true, nutrition: { cal: 580, protein: 24, carbs: 62, fat: 28, fiber: 4 } }
    ],
    "107": [ // Homestyle Dal Makhani
        { id: 701, name: "Classic Dal Makhani", price: 250, desc: "Slow-cooked black lentils with cream and butter.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A", spicy: false, veg: true, protein: true, nutrition: { cal: 450, protein: 18, carbs: 45, fat: 22, fiber: 12 } },
        { id: 702, name: "Garlic Naan", price: 50, desc: "Fresh tandoori bread topped with garlic.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl80", spicy: false, veg: true, protein: false, nutrition: { cal: 220, protein: 6, carbs: 40, fat: 4, fiber: 2 } },
        { id: 703, name: "Punjabi Lassi", price: 80, desc: "Sweet, thick yogurt drink.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", spicy: false, veg: true, protein: true, nutrition: { cal: 280, protein: 10, carbs: 35, fat: 12, fiber: 0 } }
    ],
    "108": [ // Crispy Masala Dosa
        { id: 801, name: "Ghee Roast Masala Dosa", price: 180, desc: "Crispy dosa roasted in pure ghee with spiced potato filling.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl8", spicy: false, veg: true, protein: true, nutrition: { cal: 350, protein: 8, carbs: 55, fat: 15, fiber: 4 } },
        { id: 802, name: "Medu Vada (2 pcs)", price: 90, desc: "Crispy fried lentil donuts with sambar and chutney.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: false, veg: true, protein: true, nutrition: { cal: 320, protein: 12, carbs: 40, fat: 14, fiber: 6 } },
        { id: 803, name: "Filter Coffee", price: 60, desc: "Authentic South Indian filter kaapi.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", spicy: false, veg: true, protein: false, nutrition: { cal: 80, protein: 2, carbs: 8, fat: 4, fiber: 0 } }
    ],
    "109": [ // Spicy Hyderabadi Biryani
        { id: 904, name: "Dum Mutton Biryani", price: 450, desc: "Aged basmati cooked slowly with marinated mutton in dum style.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5dhP82afCTOiEvPFGPkPq8mikHUWp_GYe6ld8PQjwT_FqCK-i9a3JWIMijmoW6kaSD2Dy-4KcQCKTzNA22KCBMiiCNVtewV2QukSo4_xqgwhWoIHXyO_laQ5IWE5swV7GY-dQ6pZ4I3UGGG1Ai6MnJiuiURgiHSK3NbH53OEVoi9Z-S0Ai2V1mADDDq94X-oSqNnrdkqoJZBL4mgXcKX16WskY-5YlLA2ubFV3g8xIr3xcKJ_4MVg9xTVlJYfJJvML7O9g8UFTbQ", spicy: true, veg: false, protein: true, nutrition: { cal: 680, protein: 45, carbs: 65, fat: 28, fiber: 4 } },
        { id: 905, name: "Chicken 65", price: 280, desc: "Spicy, deep-fried chicken starter from Chennai.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: true, veg: false, protein: true, nutrition: { cal: 420, protein: 28, carbs: 15, fat: 22, fiber: 2 } },
        { id: 906, name: "Mirchi ka Salan", price: 150, desc: "Tangy peanut and chili curry, perfect with biryani.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl80", spicy: true, veg: true, protein: false, nutrition: { cal: 310, protein: 5, carbs: 18, fat: 24, fiber: 5 } }
    ],
    "110": [ // Burger Singh
        { id: 1001, name: "Bunty Tikki Burger", price: 169, desc: "Desi tikki patty with spicy chutney.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwotfShftcZoIivNfStqksPZZJq3_P3kHjJfr0sCHXE5LTbhzLKkOA_OJCxgUgKZYUPlfb5ChZGTRAE0NzF2UOAfgyfdMA_gUNP4Wu8XHtleuLAuJbijfsQCeOsRPFZDGcbJOegIrnbxZmyaaAA5_YEiMQvAJKiFmL8qiYtr9YlebrmcuskgcTzoDjxt73HAa_rZzkodOnwJvL9RbeIsKI4RAH3O2h46Q2zOqtKkAetikJFfifqu_7hb8j6ODL-ZlrApYzVMajKyI", spicy: true, veg: true, protein: true, nutrition: { cal: 420, protein: 14, carbs: 48, fat: 20, fiber: 3 } },
        { id: 1002, name: "Chicken Amritsari Burger", price: 219, desc: "Juicy chicken with Amritsari masala.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A", spicy: true, veg: false, protein: true, nutrition: { cal: 540, protein: 28, carbs: 42, fat: 26, fiber: 2 } },
        { id: 1003, name: "Fries Singh", price: 99, desc: "Crispy fries with peri-peri seasoning.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl80", spicy: false, veg: true, protein: false, nutrition: { cal: 280, protein: 4, carbs: 36, fat: 14, fiber: 3 } }
    ],
    "111": [ // Chaayos
        { id: 1101, name: "Masala Chai", price: 120, desc: "Authentic ginger masala chai.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAl2Lb6xq-0tDopajUnW2cHR8TIOTEUEkV38RYgtmjKWnVYPl1BMsDLQhN4Ksp2NUT-4agVZt5PYoND8wd3RwRO0L4bcyWtMUa8NGLcPONnohVQmhmbDiiTSy-2pkTkTehFqwwZqD8gAe9a97PKQd1lpnBkVdpV2HW0wY3LGn-BEXUiBgtnTQJDb2hoJWYlrSxNBS6yDxaheWPuPtGoA0FCFOAxdJBYoPOaq3DTHr-j03pVm2WQAL04SHjxZmK7T9jfhxQOn9Tp-WQ", spicy: false, veg: true, protein: false, nutrition: { cal: 90, protein: 3, carbs: 12, fat: 4, fiber: 0 } },
        { id: 1102, name: "Paneer Samosa (2 pcs)", price: 140, desc: "Flaky crust filled with spiced paneer.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: true, veg: true, protein: true, nutrition: { cal: 320, protein: 10, carbs: 38, fat: 16, fiber: 4 } },
        { id: 1103, name: "Veg Maggi", price: 100, desc: "Classic 2-minute noodles, street style.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", spicy: false, veg: true, protein: false, nutrition: { cal: 380, protein: 8, carbs: 52, fat: 16, fiber: 3 } }
    ],
    "112": [ // EatFit
        { id: 1201, name: "Quinoa Salad Bowl", price: 249, desc: "Superfood bowl with quinoa, avocado, and greens.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAVX1p4LizdXBSi-G7E-HSf4qKSUMWeii6BCBJaHQ9xTW302LVviSxj2k4FCj76DpShWPlBLH3wYX09FPwgvbf7J2QPvIfIb0_WmcQZch6eRTzZB0U3c5Zdvl7bU5isn2uvrmd24yLA7FcpBScSzKL74bhUxHJ7Se_xQJzmoPNhiaCLNLTUi4qBmS6goXyzp65ptPK712gq762qd5h60-w37hdB60sDIKv88vuluk2AgoS1nw9xsTGbq4YzTvfykD8Prkg9aEbav2Q", spicy: false, veg: true, protein: true, nutrition: { cal: 320, protein: 14, carbs: 42, fat: 12, fiber: 8 } },
        { id: 1202, name: "Ragi Dosa Thali", price: 199, desc: "Healthy ragi dosa with sambar and chutneys.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuArH5JE7vTgIYMxybP_vgfWNG4CxLpFMFHlRFXT9xHW6wLDQ8C_QcR2fzK_gzzdBPZsGh0sKOAUjGY_BTeOfibAHla0O4OwE3QUpQAeUQZt9TwIEcvzrT2ZEt0JVGHb7CDjQXy_XSammpsHDABzlbNR2j1WYrudBZFRAAcgfDONLhGmumU-GE5xKmo4Y0KNcT5wPl6StcfL4P3ilVXhMJQX8QrOME1YZ4QDOamnI3D0WpPviCXtq6KFXPOEi2NaVYdTIn0NTLNxCl80", spicy: false, veg: true, protein: true, nutrition: { cal: 280, protein: 10, carbs: 48, fat: 6, fiber: 6 } },
        { id: 1203, name: "Green Detox Smoothie", price: 149, desc: "Spinach, apple, and ginger detox blend.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", spicy: false, veg: true, protein: false, nutrition: { cal: 120, protein: 3, carbs: 22, fat: 2, fiber: 4 } }
    ],
    "113": [ // Mamagoto
        { id: 1301, name: "Spicy Tonkotsu Ramen", price: 450, desc: "Rich pork bone broth ramen with toppings.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDIF4lMWRHYMebghYQVYy7kpHU-Wrn3WnbVNVhGa1fyi08tqRx8LQHhswKcvxc24fJDbhVSKUB9sEG9UpRWH3dhzbFHfGujNC40_EfpB04oxdUcmO6L2MpLM9R4XgDeywKmFdjGqPdWRj_C0YLpgbuy9X90g1X7qhjYQ7zI32vJ_krvG6qRNZbnbE2unz52MBnEajFmQH2tX9m-Sui7XvZfJ8yImX_lFk13mVMTGP9X357kD1FrfnU5ZVDdUzdSi802DvZvQbPJLHA", spicy: true, veg: false, protein: true, nutrition: { cal: 580, protein: 32, carbs: 55, fat: 24, fiber: 3 } },
        { id: 1302, name: "Dragon Chicken", price: 380, desc: "Crispy chicken tossed in spicy dragon sauce.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A", spicy: true, veg: false, protein: true, nutrition: { cal: 460, protein: 26, carbs: 22, fat: 28, fiber: 2 } },
        { id: 1303, name: "Edamame Truffle Dimsum", price: 320, desc: "Steamed dimsum with truffle oil and edamame.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: false, veg: true, protein: true, nutrition: { cal: 280, protein: 12, carbs: 30, fat: 14, fiber: 4 } }
    ],
    "default": [
        { id: 901, name: "Veg Meal", price: 120, desc: "Standard thali.", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2fKrVBlDDwDtMiJTXa3CT9vkObCVSNp7Vc-8oZUuXemiXQVSHqp6qrWh86djN2UA5xpbMsAwWHgcUkb6rYDEdesADSM7vJuhc06LiUlaT-dtFm1dJ8s-BydFsCA9YExDBBd6HAPR2B6qWO2OviGc4RGxLzpGu--gjePEq6hzTrTIVOglJPrHCq_R0esoy3QzpzLrcnumVXAVbBxKUE-WVRW1aaYVMaix9xVvSBfQRznGIXS3Im-qWY_EWWF_5D0iMVOmtkHSVKJU", spicy: false, veg: true, protein: false, nutrition: { cal: 480, protein: 14, carbs: 72, fat: 16, fiber: 8 } }
    ]
};



const ZoiBatching = {
    getConfig: () => {
        return JSON.parse(localStorage.getItem('zoi_batch_config')) || { size: 4, radius: 2.5, wait: 5 };
    },
    saveConfig: (config) => {
        localStorage.setItem('zoi_batch_config', JSON.stringify(config));
    },
    getBatches: () => {
        // Generate some dynamic mock batches based on active riders
        // (Simplification for visual demo)
        return [
            { id: "9281", rider: "Amit K.", status: "En Route", orders: 3, efficiency: 92, lat: 12.935, lng: 77.624, path: [[12.935, 77.624], [12.938, 77.620], [12.942, 77.628]] },
            { id: "9285", rider: "Sarah J.", status: "Pickup", orders: 2, efficiency: 78, lat: 12.971, lng: 77.641, path: [[12.971, 77.641], [12.975, 77.645]] },
            { id: "9290", rider: "Rahul V.", status: "Allocating", orders: 1, efficiency: 65, lat: 12.976, lng: 77.601, path: [[12.976, 77.601], [12.980, 77.605]] },
            { id: "9294", rider: "Vikram S.", status: "En Route", orders: 4, efficiency: 98, lat: 12.969, lng: 77.750, path: [[12.969, 77.750], [12.972, 77.755], [12.965, 77.745]] }
        ];
    }
};



// 12. RIDER ONBOARDING DATA (For Admin Console)
const DB_RIDER_APPLICATIONS = [
    { id: "APP-9001", name: "Amit Kumar Mishra", vehicle: "Bike", status: "New", score: 98, date: "Today, 10:00 AM" },
    { id: "APP-9002", name: "Sunil Yee", vehicle: "Scooter", status: "New", score: 85, date: "Yesterday" },
    { id: "APP-9003", name: "Ricky Pointing", vehicle: "Bike", status: "Verification", score: 92, date: "2 days ago" }
];

const ZoiRiderOnboarding = {
    getApplications: () => {
        const stored = localStorage.getItem('zoiRiderApps');
        if (!stored) {
            localStorage.setItem('zoiRiderApps', JSON.stringify(DB_RIDER_APPLICATIONS));
            return DB_RIDER_APPLICATIONS;
        }
        return JSON.parse(stored);
    },
    addApplication: (appData) => {
        const apps = ZoiRiderOnboarding.getApplications();
        const newApp = {
            id: "REQ-" + Math.floor(1000 + Math.random() * 9000),
            name: appData.name,
            phone: appData.phone,
            city: appData.city,
            vehicle: appData.vehicle,
            status: "Pending",
            docs: { license: true, rc: true, aadhar: "pending" } // Mock
        };
        apps.unshift(newApp);
        localStorage.setItem('zoiRiderApps', JSON.stringify(apps));
        return newApp;
    },
    approveApplication: (id) => {
        // Legacy support or direct approve
        return ZoiRiderOnboarding.deployRider(id);
    },
    updateStatus: (id, status) => {
        const apps = ZoiRiderOnboarding.getApplications();
        const app = apps.find(a => a.id === id);
        if (app) {
            app.status = status;
            localStorage.setItem('zoiRiderApps', JSON.stringify(apps));
        }
        return app;
    },
    deployRider: (id) => {
        const apps = ZoiRiderOnboarding.getApplications();
        const appIndex = apps.findIndex(a => a.id === id);

        if (appIndex > -1) {
            const app = apps[appIndex];

            // Remove from apps
            apps.splice(appIndex, 1);
            localStorage.setItem('zoiRiderApps', JSON.stringify(apps));

            // Add to active fleet
            const riders = ZoiFleet.getAllRiders();
            const newRider = {
                id: "ZZ-" + Math.floor(1000 + Math.random() * 9000),
                name: app.name,
                status: "Offline", // Starts offline
                trips: 0,
                time: "0m",
                rating: 5.0,
                earn: "₹0",
                zone: "Indiranagar", // Default
                lat: 12.9716, // Default
                lng: 77.6412
            };

            riders.push(newRider);
            localStorage.setItem('zoiFleet', JSON.stringify(riders));
            return newRider;
        }
        return null;
    },
    rejectApplication: (id) => {
        const apps = ZoiRiderOnboarding.getApplications();
        const newApps = apps.filter(a => a.id !== id);
        localStorage.setItem('zoiRiderApps', JSON.stringify(newApps));
    }
};

// 11. CMS DATA (For Admin Console)
const DB_CMS_ASSETS = [
    { id: 1, title: "Diwali Festival Hero Banner", type: "Home Banner", region: "India", desc: "Main homepage hero slider for Diwali.", img: "https://via.placeholder.com/400x200/221910/f27f0d?text=Diwali+Banner", score: 92, status: "Active", author: "Sarah J.", order: 1, segment: "All Users" },
    { id: 2, title: "Burger King - 50% Off", type: "Restaurant Promo", region: "South Zone", desc: "Promo for Burger King Indiranagar.", img: "https://via.placeholder.com/400x200/221910/3b82f6?text=Burger+Promo", score: 85, status: "Scheduled", author: "Auto-Bot", order: 2, segment: "Gold Members" },
    { id: 3, title: "Rainy Day Alert", type: "Notification", region: "Mumbai", desc: "Surge pricing alert text.", img: "", score: 99, status: "Active", author: "Ops Team", order: 1, segment: "All Users" }
];

const ZoiCMS = {
    getAssets: () => {
        const stored = localStorage.getItem('zoiCMS');
        if (!stored) {
            localStorage.setItem('zoiCMS', JSON.stringify(DB_CMS_ASSETS));
            return DB_CMS_ASSETS;
        }
        return JSON.parse(stored);
    },
    saveAsset: (asset) => {
        const assets = ZoiCMS.getAssets();
        const index = assets.findIndex(a => a.id == asset.id);
        if (index > -1) {
            assets[index] = asset;
        } else {
            assets.unshift(asset);
        }
        localStorage.setItem('zoiCMS', JSON.stringify(assets));
        return asset;
    },
    deleteAsset: (id) => {
        const assets = ZoiCMS.getAssets();
        const newAssets = assets.filter(a => a.id !== parseInt(id));
        localStorage.setItem('zoiCMS', JSON.stringify(newAssets));
    }
};

// 10. GAMIFICATION DATA (For Admin Console)
const DB_BADGES = [
    { id: 1, name: "Biryani Boss", icon: "rice_bowl", desc: "Order Biryani 5 times", color: "orange", status: "active" },
    { id: 2, name: "Night Owl", icon: "dark_mode", desc: "Order after 11 PM 3 times", color: "purple", status: "active" },
    { id: 3, name: "Health Nut", icon: "eco", desc: "Order 'Healthy' 5 times", color: "green", status: "library" },
    { id: 4, name: "Social Butterfly", icon: "share", desc: "Refer 3 friends", color: "blue", status: "active" }
];

const ZoiGamification = {
    getBadges: () => {
        const stored = localStorage.getItem('zoiBadges');
        if (!stored) {
            localStorage.setItem('zoiBadges', JSON.stringify(DB_BADGES));
            return DB_BADGES;
        }
        return JSON.parse(stored);
    },
    saveBadge: (badge) => {
        const badges = ZoiGamification.getBadges();
        const index = badges.findIndex(b => b.id == badge.id);
        if (index > -1) {
            badges[index] = badge;
        } else {
            badges.unshift(badge);
        }
        localStorage.setItem('zoiBadges', JSON.stringify(badges));
        return badge;
    },
    deleteBadge: (id) => {
        const badges = ZoiGamification.getBadges();
        const newBadges = badges.filter(b => b.id !== id);
        localStorage.setItem('zoiBadges', JSON.stringify(newBadges));
    },
    toggleStatus: (id) => {
        const badges = ZoiGamification.getBadges();
        const b = badges.find(x => x.id === id);
        if (b) {
            b.status = b.status === 'active' ? 'library' : 'active';
            localStorage.setItem('zoiBadges', JSON.stringify(badges));
        }
    },
    // Config
    getConfig: () => {
        return JSON.parse(localStorage.getItem('zoiPointsConfig')) || { base: 10, review: 50, ref: 500 };
    },
    saveConfig: (config) => {
        localStorage.setItem('zoiPointsConfig', JSON.stringify(config));
    }
};

// 9. PROMO CODES DATA (For Admin Console)
const DB_PROMOS = [
    { id: 1, code: "ZIPZAP50", type: "%", val: "50", cap: "150", used: 450, limit: 1000, status: "Active", date: "2026-10-24", desc: "New User Acquisition" },
    { id: 2, code: "WELCOME20", type: "flat", val: "100", cap: "-", used: 120, limit: 500, status: "Active", date: "2026-11-01", desc: "Retargeting" },
    { id: 3, code: "FESTIVE30", type: "%", val: "30", cap: "200", used: 0, limit: 5000, status: "Scheduled", date: "2026-12-25", desc: "Holiday Special" },
    { id: 4, code: "FREESHIP", type: "flat", val: "40", cap: "-", used: 800, limit: 800, status: "Expired", date: "2025-09-15", desc: "Ended Campaign" }
];

const ZoiPromos = {
    getAll: () => {
        const stored = localStorage.getItem('zoiPromos');
        if (!stored) {
            localStorage.setItem('zoiPromos', JSON.stringify(DB_PROMOS));
            return DB_PROMOS;
        }
        return JSON.parse(stored);
    },
    addPromo: (promo) => {
        const promos = ZoiPromos.getAll();
        promos.unshift(promo);
        localStorage.setItem('zoiPromos', JSON.stringify(promos));
        return promo;
    },
    updatePromo: (id, updates) => {
        const promos = ZoiPromos.getAll();
        const index = promos.findIndex(p => p.id == id);
        if (index > -1) {
            promos[index] = { ...promos[index], ...updates };
            localStorage.setItem('zoiPromos', JSON.stringify(promos));
            return promos[index];
        }
        return null;
    },
    deletePromo: (id) => {
        const promos = ZoiPromos.getAll();
        const newPromos = promos.filter(p => p.id !== id);
        localStorage.setItem('zoiPromos', JSON.stringify(newPromos));
    }
};

// 8. USER DATABASE (For Admin Console)
const DB_USERS = [
    // Partners
    { id: "PART-102", name: "Spicy Tandoor", email: "manager@spicy.com", role: "partner", status: "Active", score: 88, lastActive: "2m ago", spend: "₹1.2L", orders: 120 },
    { id: "PART-331", name: "Pizza Hut", email: "ops@pizzahut.com", role: "partner", status: "Active", score: 99, lastActive: "1m ago", spend: "₹5.6L", orders: 3400 },
    { id: "PART-404", name: "Burger King", email: "bk@support.com", role: "partner", status: "Suspended", score: 45, lastActive: "3d ago", spend: "₹2.1L", orders: 890 },
    // Customers
    { id: "CUST-552", name: "Rahul Verma", email: "rahul@gmail.com", role: "customer", status: "Suspended", score: 40, lastActive: "2 days ago", spend: "₹450", orders: 2 },
    { id: "CUST-101", name: "Priya Sharma", email: "priya.s@yahoo.com", role: "customer", status: "Active", score: 95, lastActive: "1hr ago", spend: "₹12,400", orders: 45 },
    { id: "CUST-332", name: "Amit Patel", email: "amit.p@gmail.com", role: "customer", status: "Active", score: 82, lastActive: "5m ago", spend: "₹3,200", orders: 12 },
    // Riders
    { id: "RIDE-991", name: "Vikram Singh", email: "vikram@zoi.com", role: "rider", status: "Active", score: 75, lastActive: "Online", spend: "₹12k", orders: 110 },
    { id: "RIDE-202", name: "Suresh Kumar", email: "suresh@zoi.com", role: "rider", status: "Pending", score: 100, lastActive: "Offline", spend: "₹0", orders: 0 },
    // POS
    { id: "POS-01", name: "Neha Cashier", email: "neha@spicy.com", role: "pos_staff", status: "Active", score: 100, lastActive: "1m ago", spend: "₹0", orders: 0 }
];

const ZoiUsers = {
    getAll: () => {
        const stored = localStorage.getItem('zoiUsers');
        if (!stored) {
            localStorage.setItem('zoiUsers', JSON.stringify(DB_USERS));
            return DB_USERS;
        }
        return JSON.parse(stored);
    },
    updateStatus: (id, status) => {
        const users = ZoiUsers.getAll();
        const index = users.findIndex(u => u.id === id);
        if (index > -1) {
            users[index].status = status;
            localStorage.setItem('zoiUsers', JSON.stringify(users));
            return users[index];
        }
        return null;
    },
    authenticate: (input, role) => {
        const users = ZoiUsers.getAll();
        // Simple check: match email OR phone OR ID
        const user = users.find(u =>
            (u.email === input || u.phone === input || u.id === input) &&
            u.role === role
        );

        if (!user) {
            // detailed mock fallbacks for demo if not in DB
            if (input === 'pos_staff') {
                return { id: "POS-99", name: "Guest Cashier", email: "pos@restaurant.com", role: "pos_staff" };
            }
            if (input === 'demo' || input === 'admin') return MOCK_USERS[role];
            return null;
        }

        if (user.status === 'Suspended' || user.status === 'Banned') {
            throw new Error(`Account ${user.status}: Please contact support.`);
        }

        if (role === 'partner') {
            const restaurants = typeof ZoiRestaurants !== 'undefined' ? ZoiRestaurants.getAll() : (typeof DB_RESTAURANTS !== 'undefined' ? DB_RESTAURANTS : []);
            // Check if the user's email matches the restaurant owner's email, or just default to the first pos-only for testing
            const ownedRest = restaurants.find(r => r.phone.includes(input) || (user.email && user.email.includes(input))) || restaurants.find(r => r.isPosOnly);

            if (ownedRest && ownedRest.isPosOnly) {
                user.isPosOnly = true;
                user.restaurantId = ownedRest.id;
            }
        }

        return user;
    }
};

// 7. RESTAURANT ONBOARDING DATA (For Admin Console)
const DB_REST_APPLICATIONS = [
    { id: "REQ-8821", name: "Tandoori Nights", owner: "Rajesh Kumar", phone: "+91 98765 43210", zone: "Indiranagar", docs: { fssai: true, gst: true, bank: "pending" }, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg", tags: ["North Indian"], rating: 0, time: "30-40 min", cost: "₹400 for two", promoted: false, offer: null },
    { id: "REQ-8822", name: "Pizza Paradise", owner: "Anita Roy", phone: "+91 99887 77665", zone: "Koramangala", docs: { fssai: true, gst: false, bank: true }, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrBr_Vl9zQLsmVatsZdkKvkWUJMVLTM-tv-jxDdtUJbz8hnP31qvsZDabXkYAiSqiZVfXWap8tc1Vmx-FlI-koVR5nh1WOEu7Y7uUkSKrSPHlDUSBPVWNE2Da2x5IF-081vD31RdPmULTi_toqfG6bs_T6n1I0B3YmNTp6MxPl1zFXnCgV_GpURdugB8jlKS5EAe5J9H9yXul75DSlTqEjdTgCydn28M9P875PAw8HByt5v0riWELtXF6-7GIlu4rOVEEyQiFJr1Q", tags: ["Pizza"], rating: 0, time: "45 min", cost: "₹300 for two", promoted: false, offer: null },
    { id: "REQ-8823", name: "Chai Point", owner: "Suresh P", phone: "+91 91234 56789", zone: "Whitefield", docs: { fssai: true, gst: true, bank: true }, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", tags: ["Beverages"], rating: 0, time: "10-20 min", cost: "₹150 for two", promoted: false, offer: null },
    { id: "REQ-9001", name: "Grill House BBQ", owner: "Vikram Mehta", phone: "+91 98112 33445", zone: "Unassigned", docs: { fssai: "pending", gst: "pending", bank: "pending" }, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg", tags: ["POS Default"], rating: 0, time: "30 min", cost: "₹300 for two", promoted: false, offer: null, isPosOnly: true, plan: "yearly" },
    { id: "REQ-9002", name: "Café Mocha Express", owner: "Priya Sharma", phone: "+91 87654 12309", zone: "Unassigned", docs: { fssai: "pending", gst: "pending", bank: "pending" }, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD2SNH6V0B30A5dG8Uk1IrNgNqPtufwEs7hz-Cg5msrHtETgmpdJbSHVm8xFWWhV9NiFMmTQURQZJB_CfEbiJT79Imms8JIjeehBWjwKhlV0zKZEKGOq2WijsOUyi_auTeykdrjcqeMSpKEYOdmRtUAcJbzNFdmWqx0hBSrvrXphk4XFjXkTxPvaHMdwcCQ4Jcnp_1MeRsl9AnnklKR8WXlPdKomDkbSKzqPWRbHu74DzM8PcALJo8ltUNX56B6-eRZnn5fjuHZ7_g", tags: ["POS Default"], rating: 0, time: "15 min", cost: "₹200 for two", promoted: false, offer: null, isPosOnly: true, plan: "quarterly" }
];

const ZoiRestaurants = {
    getAll: () => {
        const stored = localStorage.getItem('zoiRest');
        if (!stored) {
            localStorage.setItem('zoiRest', JSON.stringify(DB_RESTAURANTS));
            return DB_RESTAURANTS;
        }
        return JSON.parse(stored);
    },
    getApplications: () => {
        const stored = localStorage.getItem('zoiRestApps');
        if (!stored) {
            localStorage.setItem('zoiRestApps', JSON.stringify(DB_REST_APPLICATIONS));
            return DB_REST_APPLICATIONS;
        }
        return JSON.parse(stored);
    },
    addApplication: (appData) => {
        const apps = ZoiRestaurants.getApplications();
        const newApp = {
            id: "REQ-" + Math.floor(1000 + Math.random() * 9000),
            name: appData.name,
            owner: appData.owner,
            phone: appData.phone,
            zone: appData.zone,
            docs: { fssai: "pending", gst: "pending", bank: "pending" },
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg", // Mock
            tags: [appData.category],
            rating: 0,
            time: "30 min",
            cost: "₹300 for two",
            promoted: false,
            offer: null,
            isPosOnly: appData.isPosOnly || false,
            plan: appData.plan || null
        };
        apps.unshift(newApp);
        localStorage.setItem('zoiRestApps', JSON.stringify(apps));
        return newApp;
    },
    approveApplication: (id) => {
        const apps = ZoiRestaurants.getApplications();
        const appIndex = apps.findIndex(a => a.id === id);

        if (appIndex > -1) {
            const app = apps[appIndex];

            // Remove from apps
            apps.splice(appIndex, 1);
            localStorage.setItem('zoiRestApps', JSON.stringify(apps));

            // Add to active restaurants
            const restaurants = ZoiRestaurants.getAll();
            const newRest = {
                id: (parseInt(Math.max(...restaurants.map(r => parseInt(r.id)))) + 1).toString(), // Generate numeric ID like "107"
                name: app.name,
                image: app.image,
                tags: app.tags,
                rating: 5.0, // New listing boost
                time: app.time,
                cost: app.cost,
                promoted: true, // Launch promotion
                offer: "New Arrival 20% OFF",
                isPosOnly: app.isPosOnly || false
            };

            restaurants.push(newRest);
            localStorage.setItem('zoiRest', JSON.stringify(restaurants));
            return newRest;
        }
        return null;
    },
    rejectApplication: (id) => {
        const apps = ZoiRestaurants.getApplications();
        const newApps = apps.filter(a => a.id !== id);
        localStorage.setItem('zoiRestApps', JSON.stringify(newApps));
    }
};

// 6. REFUNDS & DISPUTES DATA (For Admin Console)
const DB_REFUNDS = [
    { id: "R-1092", date: new Date().toISOString().split('T')[0], rest: "Burger King", order: "ORD-9921", cust: "Sophia R.", reason: "Missing Item", amt: "₹120", risk: 5, status: "Pending", items: "Fries", desc: "Missing fries.", pay: "UPI", receipt: [{ n: "Burger", p: "₹250" }, { n: "Fries", p: "₹120" }] },
    { id: "R-1093", date: new Date().toISOString().split('T')[0], rest: "Pizza Hut", order: "ORD-8812", cust: "Rahul K.", reason: "Cold Food", amt: "₹450", risk: 45, status: "Pending", items: "Pizza (L)", desc: "Stone cold.", pay: "Card", receipt: [{ n: "Pizza", p: "₹450" }] },
    { id: "R-1094", date: new Date().toISOString().split('T')[0], rest: "Taco Bell", order: "ORD-7763", cust: "Liam T.", reason: "Changed Mind", amt: "₹85", risk: 85, status: "Pending", items: "Coke", desc: "Cancel order.", pay: "Wallet", receipt: [{ n: "Tacos", p: "₹200" }, { n: "Coke", p: "₹85" }] },
    { id: "R-1088", date: "2023-10-20", rest: "KFC", order: "ORD-5541", cust: "Amit S.", reason: "Late", amt: "₹100", risk: 10, status: "Approved", items: "Bucket", desc: "Too late.", pay: "UPI", receipt: [] },
    { id: "R-1085", date: new Date().toISOString().split('T')[0], rest: "Subway", order: "ORD-3321", cust: "Bot User", reason: "Fraud", amt: "₹500", risk: 99, status: "Auto-Rejected", items: "Sub", desc: "System flagged.", pay: "Card", receipt: [] }
];

const ZoiRefunds = {
    getAll: () => {
        const stored = localStorage.getItem('zoiRefunds');
        if (!stored) {
            localStorage.setItem('zoiRefunds', JSON.stringify(DB_REFUNDS));
            return DB_REFUNDS;
        }
        return JSON.parse(stored);
    },
    updateStatus: (id, status) => {
        const refunds = ZoiRefunds.getAll();
        const r = refunds.find(x => x.id === id);
        if (r) {
            r.status = status;
            localStorage.setItem('zoiRefunds', JSON.stringify(refunds));
        }
        return r;
    },
    autoResolve: () => {
        // God Mode: Bulk resolve low risk to Approved, high risk to Rejected
        const refunds = ZoiRefunds.getAll();
        let count = 0;
        refunds.forEach(r => {
            if (r.status === 'Pending') {
                if (r.risk < 20) r.status = 'Approved';
                else if (r.risk > 80) r.status = 'Auto-Rejected';
                if (r.status !== 'Pending') count++;
            }
        });
        localStorage.setItem('zoiRefunds', JSON.stringify(refunds));
        return count;
    },
    addRefund: (refund) => {
        const refunds = ZoiRefunds.getAll();
        refunds.unshift(refund);
        localStorage.setItem('zoiRefunds', JSON.stringify(refunds));
        return refund;
    }
};

// 5. SUBSCRIPTIONS DATA (For Admin Console)
const DB_SUBSCRIPTIONS = [
    { id: 1, name: "Aditi Sharma", email: "aditi.s@example.com", plan: "ZipZap Gold", status: "Active", amt: "₹399", renewal: "Oct 24, 2026", ltv: 5400 },
    { id: 2, name: "Rahul Verma", email: "rahul.v@example.com", plan: "Zoi Platinum", status: "Past Due", amt: "₹599", renewal: "Oct 20, 2026", ltv: 8900 },
    { id: 3, name: "Sarah Jenkins", email: "sarah.j@example.com", plan: "ZipZap Starter", status: "Cancelled", amt: "₹99", renewal: "--", ltv: 1500 },
    { id: 4, name: "David Chen", email: "david.c@example.com", plan: "ZipZap Starter", status: "Active", amt: "₹99", renewal: "Nov 02, 2026", ltv: 600 },
    { id: 5, name: "Priya Patel", email: "priya.p@example.com", plan: "ZipZap Gold", status: "Active", amt: "₹399", renewal: "Nov 15, 2026", ltv: 2000 },
    { id: 6, name: "Amit Shah", email: "amit.s@example.com", plan: "Zoi Platinum", status: "Active", amt: "₹599", renewal: "Dec 01, 2026", ltv: 12000 },
    { id: 7, name: "Neha Gupta", email: "neha.g@example.com", plan: "ZipZap Gold", status: "Paused", amt: "₹399", renewal: "Jan 10, 2027", ltv: 3200 },
    { id: 8, name: "Vikram Rathore", email: "vikram.r@example.com", plan: "ZipZap Starter", status: "Active", amt: "₹99", renewal: "Feb 28, 2027", ltv: 450 }
];

const DB_SUBSCRIPTION_PLANS = [
    { id: "starter", name: "ZipZap Starter", price: 99, period: "Monthly", benefits: ["Free Delivery < 5km", "No Surge Pricing"], active: true, color: "yellow" },
    { id: "gold", name: "ZipZap Gold", price: 399, period: "Monthly", benefits: ["Free Delivery < 10km", "Priority Support", "No Surge"], active: true, color: "orange" },
    { id: "platinum", name: "Zoi Platinum", price: 599, period: "Monthly", benefits: ["Unlimited Free Del", "VVIP Support", "Exclusive Events"], active: true, color: "purple" }
];

const ZoiSubscriptions = {
    getAll: () => {
        const stored = localStorage.getItem('zoiSubs');
        if (!stored) {
            localStorage.setItem('zoiSubs', JSON.stringify(DB_SUBSCRIPTIONS));
            return DB_SUBSCRIPTIONS;
        }
        return JSON.parse(stored);
    },
    update: (id, updates) => {
        const subs = ZoiSubscriptions.getAll();
        const index = subs.findIndex(s => s.id === id);
        if (index > -1) {
            subs[index] = { ...subs[index], ...updates };
            localStorage.setItem('zoiSubs', JSON.stringify(subs));
            return subs[index];
        }
        return null;
    },
    // Plans
    getPlans: () => {
        const stored = localStorage.getItem('zoiPlans');
        if (!stored) {
            localStorage.setItem('zoiPlans', JSON.stringify(DB_SUBSCRIPTION_PLANS));
            return DB_SUBSCRIPTION_PLANS;
        }
        return JSON.parse(stored);
    },
    savePlan: (plan) => {
        const plans = ZoiSubscriptions.getPlans();
        const index = plans.findIndex(p => p.id === plan.id);
        if (index > -1) plans[index] = plan;
        localStorage.setItem('zoiPlans', JSON.stringify(plans));
    }
};

// --- NEW FOR PHASE 8: INVENTORY ENGINE ---
const DB_INVENTORY_START = [
    { id: "INV-001", name: "Burger Buns", category: "Raw Material", stock: 150, unit: "pcs", minStock: 50 },
    { id: "INV-002", name: "Pizza Base (Medium)", category: "Raw Material", stock: 80, unit: "pcs", minStock: 20 },
    { id: "INV-003", name: "Chicken Patty", category: "Raw Material", stock: 100, unit: "pcs", minStock: 30 },
    { id: "INV-004", name: "Mozzarella Cheese", category: "Dairy", stock: 45, unit: "kg", minStock: 10 },
    { id: "INV-005", name: "Coke (Can)", category: "Beverage", stock: 200, unit: "cans", minStock: 50 },
    { id: "INV-006", name: "Coffee Beans", category: "Raw Material", stock: 5, unit: "kg", minStock: 8 } // Critical out of box
];

const ZoiInventory = {
    getInventory: (restId) => {
        const stored = localStorage.getItem(`zoiInv_${restId}`);
        if (!stored) {
            localStorage.setItem(`zoiInv_${restId}`, JSON.stringify(DB_INVENTORY_START));
            return DB_INVENTORY_START;
        }
        return JSON.parse(stored);
    },
    updateStock: (restId, itemId, qtyChange) => {
        let inv = ZoiInventory.getInventory(restId);
        let item = inv.find(i => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());
        if (item) {
            item.stock += qtyChange;
            if (item.stock < 0) item.stock = 0;
            localStorage.setItem(`zoiInv_${restId}`, JSON.stringify(inv));

            // Trigger alerts natively if critical
            if (item.stock <= item.minStock) {
                console.warn(`[ZoiInventory] Low Stock Alert: ${item.name} (${item.stock} ${item.unit} left)`);
            }
            return item;
        }
        return null;
    },
    autoDeductFromOrder: (restId, orderItems) => {
        orderItems.forEach(item => {
            const itemName = item.name.toLowerCase();
            const qty = item.qty || 1;

            // Very rough recipe mapping for simulation
            if (itemName.includes('burger')) {
                ZoiInventory.updateStock(restId, 'Burger Buns', -qty);
                if (itemName.includes('chicken')) ZoiInventory.updateStock(restId, 'Chicken Patty', -qty);
            }
            if (itemName.includes('pizza')) {
                ZoiInventory.updateStock(restId, 'Pizza Base (Medium)', -qty);
                ZoiInventory.updateStock(restId, 'Mozzarella Cheese', -(qty * 0.2)); // 200g per pizza
            }
            if (itemName.includes('coke') || itemName.includes('cola')) {
                ZoiInventory.updateStock(restId, 'Coke (Can)', -qty);
            }
            if (itemName.includes('coffee') || itemName.includes('cappuccino')) {
                ZoiInventory.updateStock(restId, 'Coffee Beans', -(qty * 0.02)); // 20g per cup
            }
        });
    }
};

const ZoiRestStaff = {
    getStaffStats: (restId) => {
        const stored = localStorage.getItem(`zoiStaff_${restId}`);
        if (!stored) {
            // Default empty stats keyed by staff name
            return {};
        }
        return JSON.parse(stored);
    },
    addSale: (restId, staffName, amountStr, method) => {
        let stats = ZoiRestStaff.getStaffStats(restId);
        if (!stats[staffName]) {
            stats[staffName] = { salesTotal: 0, orderCount: 0, cashCollected: 0, upiCollected: 0, cardCollected: 0 };
        }

        let amt = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
        if (isNaN(amt)) amt = 0;

        stats[staffName].salesTotal += amt;
        stats[staffName].orderCount += 1;

        if (method === 'Cash') stats[staffName].cashCollected += amt;
        else if (method === 'UPI') stats[staffName].upiCollected += amt;
        else if (method === 'Card') stats[staffName].cardCollected += amt;

        localStorage.setItem(`zoiStaff_${restId}`, JSON.stringify(stats));
        return stats[staffName];
    },
    endShift: (restId, staffName) => {
        // In a real app, this would archive the shift to the cloud and reset local.
        // For simulation, we'll just clear their daily counters.
        let stats = ZoiRestStaff.getStaffStats(restId);
        if (stats[staffName]) {
            const shiftSummary = { ...stats[staffName] };
            stats[staffName] = { salesTotal: 0, orderCount: 0, cashCollected: 0, upiCollected: 0, cardCollected: 0 };
            localStorage.setItem(`zoiStaff_${restId}`, JSON.stringify(stats));
            return shiftSummary;
        }
        return null;
    }
};

// 4. ACTIVE FLEET DATA (For Admin Console)
const DB_RIDERS = [
    { id: "ZZ-8821", name: "Rahul Kumar", status: "Online", trips: 18, time: "22m", rating: 4.9, earn: "₹1,240", zone: "South Delhi", lat: 12.9716, lng: 77.6412 },
    { id: "ZZ-9943", name: "Priya Singh", status: "Busy", trips: 21, time: "19m", rating: 5.0, earn: "₹1,560", zone: "Indiranagar", lat: 12.9352, lng: 77.6245 },
    { id: "ZZ-1022", name: "Vikram Das", status: "High Risk", trips: 4, time: "--", rating: 3.2, earn: "₹320", zone: "Koramangala", lat: 12.9698, lng: 77.7500 },
    { id: "ZZ-1102", name: "Aman Gupta", status: "Online", trips: 12, time: "28m", rating: 4.7, earn: "₹980", zone: "South Delhi", lat: 12.98, lng: 77.60 },
    { id: "ZZ-1205", name: "Kunal Shah", status: "Online", trips: 9, time: "31m", rating: 4.6, earn: "₹750", zone: "Indiranagar", lat: 12.94, lng: 77.63 },
    { id: "ZZ-1310", name: "Ria Sharma", status: "Offline", trips: 0, time: "--", rating: 4.8, earn: "₹0", zone: "Koramangala", lat: 12.96, lng: 77.74 },
    { id: "ZZ-1455", name: "Arjun Reddy", status: "Busy", trips: 15, time: "24m", rating: 4.9, earn: "₹1,100", zone: "South Delhi", lat: 12.975, lng: 77.645 },
    { id: "ZZ-1588", name: "Sameer Khan", status: "High Risk", trips: 2, time: "--", rating: 2.8, earn: "₹150", zone: "Indiranagar", lat: 12.93, lng: 77.62 },
    { id: "ZZ-1622", name: "Deepak Verma", status: "Online", trips: 20, time: "20m", rating: 5.0, earn: "₹1400", zone: "Koramangala", lat: 12.965, lng: 77.755 },
    { id: "ZZ-1701", name: "Sneha Patil", status: "Offline", trips: 5, time: "30m", rating: 4.5, earn: "₹400", zone: "South Delhi", lat: 12.985, lng: 77.61 },
    { id: "ZZ-1899", name: "Raj Malhotra", status: "Online", trips: 14, time: "26m", rating: 4.7, earn: "₹1050", zone: "Indiranagar", lat: 12.95, lng: 77.64 },
    { id: "ZZ-1900", name: "Amitabh B", status: "Busy", trips: 30, time: "15m", rating: 5.0, earn: "₹2500", zone: "Koramangala", lat: 12.955, lng: 77.76 }
];

// 5. FLEET MANAGEMENT SYSTEM
const ZoiFleet = {
    getAllRiders: () => {
        const stored = localStorage.getItem('zoiFleet');
        if (!stored) {
            localStorage.setItem('zoiFleet', JSON.stringify(DB_RIDERS));
            return DB_RIDERS;
        }
        return JSON.parse(stored);
    },
    updateRiderStatus: (id, status) => {
        const riders = ZoiFleet.getAllRiders();
        const rider = riders.find(r => r.id === id);
        if (rider) {
            rider.status = status;
            localStorage.setItem('zoiFleet', JSON.stringify(riders));
        }
        return rider;
    }
};



const ZoiOrders = {
    // Create new order from cart
    createOrder: (cartItems, total, restaurantId = "101", restaurantName = "Spice Symphony") => {
        const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
        const rider = MOCK_USERS.rider;
        const newOrder = {
            id: orderId,
            status: 'placed', // placed -> confirmed -> preparing -> ready_for_pickup -> out_for_delivery -> delivered
            items: cartItems,
            total,
            restaurantId,
            restaurantName,
            customerId: "CUST-001",
            riderId: "RIDER-001",
            riderName: rider.name,
            riderPhone: rider.phone,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            estimatedTime: "30-40 min"
        };

        // APPLY GOD MODE: Surge Pricing
        const systemConfig = ZoiSystem.getConfig();
        if (systemConfig.surgeMultiplier > 1.0) {
            const surgeFee = Math.round(total * (systemConfig.surgeMultiplier - 1));
            newOrder.items.push({
                name: "⚡ Peak Hour Surge",
                price: surgeFee,
                qty: 1,
                isSurge: true
            });
            newOrder.total = total + surgeFee;
            newOrder.isSurge = true;
        }

        localStorage.setItem('zoiActiveOrder', JSON.stringify(newOrder));
        return newOrder;
    },

    // Get active order
    getActiveOrder: () => {
        return JSON.parse(localStorage.getItem('zoiActiveOrder'));
    },

    // Update Status
    updateStatus: (status) => {
        const order = JSON.parse(localStorage.getItem('zoiActiveOrder'));
        if (order) {
            // Rider at restaurant — set flag WITHOUT changing order status
            if (status === 'rider_at_restaurant') {
                order.riderAtRestaurant = true;
                if (!order.statusTimestamps) order.statusTimestamps = {};
                order.statusTimestamps['rider_at_restaurant'] = new Date().toISOString();
                localStorage.setItem('zoiActiveOrder', JSON.stringify(order));
                return order;
            }

            // Rider heading to restaurant — set flag WITHOUT changing order status
            if (status === 'heading_to_restaurant') {
                order.riderHeadingToRestaurant = true;
                if (!order.statusTimestamps) order.statusTimestamps = {};
                order.statusTimestamps['heading_to_restaurant'] = new Date().toISOString();
                localStorage.setItem('zoiActiveOrder', JSON.stringify(order));
                return order;
            }

            order.status = status;
            // Track timestamps for each status change
            if (!order.statusTimestamps) order.statusTimestamps = {};
            order.statusTimestamps[status] = new Date().toISOString();
            // Set rider assignment flag
            if (status === 'confirmed' || status === 'preparing') {
                order.riderAssigned = true;
            }
            if (status === 'delivered') {
                order.deliveredAt = new Date().toISOString();
            }
            localStorage.setItem('zoiActiveOrder', JSON.stringify(order));
            return order;
        }
        return null;
    },

    // Get past completed orders
    getCompletedOrders: () => {
        const stored = localStorage.getItem('zoiCompletedOrders');
        if (!stored) return [];
        return JSON.parse(stored);
    },

    // Move active order to completed history
    completeActiveOrder: (rating = 0) => {
        const order = ZoiOrders.getActiveOrder();
        if (order) {
            order.rating = rating;
            const completed = ZoiOrders.getCompletedOrders();
            completed.unshift(order); // add to top
            localStorage.setItem('zoiCompletedOrders', JSON.stringify(completed));
            localStorage.removeItem('zoiActiveOrder');
            return true;
        }
        return false;
    }
};

// 7. DISPUTE RESOLUTION DATA
const DB_DISPUTES = [
    {
        id: "TKT-8992",
        title: "Missing Items: Biryani Combo",
        user: "Aditi Rao",
        time: "10:24 AM",
        status: "Active",
        type: "Standard",
        ai: "Customer reported missing 'Raita' and 'Salad' from the Spice Symphony combo. High probability of restaurant error based on historical data.",
        log: [
            { role: "system", msg: "Ticket created. AI categorized as 'Missing Items'." },
            { role: "cust", msg: "Hi, I just received my order but the raita and salad that comes with the biryani are missing." },
            { role: "driver", msg: "I handed over the sealed bag exactly as the restaurant gave it to me." }
        ],
        items: [
            { n: "Chicken Biryani Combo", p: "₹350" },
            { n: "Extra Raita (Missing)", p: "₹0" }
        ]
    },
    {
        id: "TKT-8993",
        title: "Cold Food Delivered",
        user: "Rahul S.",
        time: "09:45 AM",
        status: "Escalated",
        type: "Critical",
        ai: "Rider took 45 minutes for a 15-minute route. GPS shows rider stopped for 20 minutes midway. High probability of rider fault.",
        assignedTo: "EMP-042", // Assigned to Dispute Manager Kavya
        log: [
            { role: "system", msg: "Ticket created. SLA breached by 30 mins." },
            { role: "cust", msg: "My pizza is ice cold. The app said it would be here half an hour ago!" },
            { role: "system", msg: "Automated message sent to rider." },
            { role: "driver", msg: "Traffic was very bad sir, sorry." }
        ],
        items: [
            { n: "Cheesy 7 Pizza", p: "₹450" },
            { n: "Garlic Bread", p: "₹120" }
        ]
    },
    {
        id: "TKT-8994",
        title: "Wrong Item Delivered",
        user: "Priya M.",
        time: "Yesterday",
        status: "Resolved",
        type: "Standard",
        ai: "Customer ordered Veg Burger, received Chicken Burger. Resolution: 100% Refund issued to wallet.",
        log: [
            { role: "system", msg: "Ticket created. Issue: Incorrect Order." },
            { role: "cust", msg: "I am vegetarian and I got a chicken burger. This is unacceptable." },
            { role: "system", msg: "Agent issued full refund of ₹199 to Zoi Wallet." }
        ],
        items: [
            { n: "Veggie Burger (Ordered)", p: "₹129" },
            { n: "Chicken Burger (Received)", p: "₹199" }
        ]
    }
];

const ZoiDisputes = {
    // Initialize DB
    init: () => {
        if (!localStorage.getItem('zoiDisputes')) {
            localStorage.setItem('zoiDisputes', JSON.stringify(DB_DISPUTES));
        }
    },

    // Get all disputes
    getAll: () => {
        return JSON.parse(localStorage.getItem('zoiDisputes')) || [];
    },

    // Get dispute by ID
    getById: (id) => {
        const disputes = ZoiDisputes.getAll();
        return disputes.find(d => d.id === id);
    },

    // Update dispute status
    updateStatus: (id, newStatus, logEntry = null) => {
        let disputes = ZoiDisputes.getAll();
        const index = disputes.findIndex(d => d.id === id);
        if (index !== -1) {
            disputes[index].status = newStatus;
            if (logEntry) {
                disputes[index].log.push(logEntry);
            } else {
                disputes[index].log.push({ role: "system", msg: `Status updated to ${newStatus}` });
            }
            localStorage.setItem('zoiDisputes', JSON.stringify(disputes));
            return disputes[index];
        }
        return null;
    },

    // Add message to dispute log
    addLog: (id, logEntry) => {
        let disputes = ZoiDisputes.getAll();
        const index = disputes.findIndex(d => d.id === id);
        if (index !== -1) {
            disputes[index].log.push(logEntry);
            localStorage.setItem('zoiDisputes', JSON.stringify(disputes));
            return disputes[index];
        }
        return null;
    }
};

// Initialize Disputes on load
ZoiDisputes.init();


// ═══════════════════════════════════════════════════════════
// 13. ZOI NUTRITION MODULE — AI Health Goals & Meal Scoring
// ═══════════════════════════════════════════════════════════
const NUTRITION_ESTIMATE_TABLE = {
    biryani: { cal: 520, protein: 30, carbs: 62, fat: 16, fiber: 3 },
    chicken: { cal: 450, protein: 35, carbs: 10, fat: 22, fiber: 1 },
    paneer: { cal: 350, protein: 22, carbs: 12, fat: 24, fiber: 2 },
    burger: { cal: 550, protein: 24, carbs: 45, fat: 30, fiber: 2 },
    pizza: { cal: 680, protein: 20, carbs: 72, fat: 32, fiber: 3 },
    naan: { cal: 260, protein: 7, carbs: 45, fat: 6, fiber: 2 },
    salad: { cal: 150, protein: 6, carbs: 18, fat: 7, fiber: 5 },
    coffee: { cal: 120, protein: 4, carbs: 16, fat: 5, fiber: 0 },
    ramen: { cal: 480, protein: 20, carbs: 58, fat: 16, fiber: 2 },
    sushi: { cal: 320, protein: 18, carbs: 42, fat: 8, fiber: 1 },
    tikka: { cal: 350, protein: 26, carbs: 12, fat: 20, fiber: 2 },
    fries: { cal: 380, protein: 4, carbs: 48, fat: 20, fiber: 3 },
    thali: { cal: 620, protein: 18, carbs: 80, fat: 20, fiber: 8 },
    pasta: { cal: 520, protein: 16, carbs: 65, fat: 18, fiber: 3 },
    wrap: { cal: 420, protein: 22, carbs: 40, fat: 16, fiber: 4 },
    juice: { cal: 140, protein: 2, carbs: 32, fat: 0, fiber: 1 },
    dessert: { cal: 350, protein: 4, carbs: 55, fat: 14, fiber: 1 },
    meal: { cal: 480, protein: 14, carbs: 72, fat: 16, fiber: 8 },
    'default': { cal: 400, protein: 15, carbs: 45, fat: 16, fiber: 3 }
};

const ZoiNutrition = {
    getGoals: () => {
        return JSON.parse(localStorage.getItem('zoiHealthGoals')) || {
            calories: 2000, protein: 60, carbs: 250, fat: 65, dietType: 'balanced'
        };
    },
    saveGoals: (goals) => {
        localStorage.setItem('zoiHealthGoals', JSON.stringify(goals));
    },

    getTodayIntake: () => {
        const today = new Date().toDateString();
        const stored = JSON.parse(localStorage.getItem('zoiDailyIntake')) || {};
        return stored[today] || { cal: 0, protein: 0, carbs: 0, fat: 0, items: [] };
    },
    addToIntake: (item) => {
        const today = new Date().toDateString();
        const stored = JSON.parse(localStorage.getItem('zoiDailyIntake')) || {};
        if (!stored[today]) stored[today] = { cal: 0, protein: 0, carbs: 0, fat: 0, items: [] };

        const nut = item.nutrition || ZoiNutrition.estimateNutrition(item.name);
        stored[today].cal += nut.cal;
        stored[today].protein += nut.protein;
        stored[today].carbs += nut.carbs;
        stored[today].fat += nut.fat;
        stored[today].items.push({ name: item.name, cal: nut.cal, time: new Date().toLocaleTimeString() });

        localStorage.setItem('zoiDailyIntake', JSON.stringify(stored));
        return stored[today];
    },

    estimateNutrition: (itemName) => {
        const lower = itemName.toLowerCase();
        for (const key of Object.keys(NUTRITION_ESTIMATE_TABLE)) {
            if (key !== 'default' && lower.includes(key)) return { ...NUTRITION_ESTIMATE_TABLE[key] };
        }
        return { ...NUTRITION_ESTIMATE_TABLE['default'] };
    },

    scoreItem: (item) => {
        const goals = ZoiNutrition.getGoals();
        const nut = item.nutrition || ZoiNutrition.estimateNutrition(item.name);
        const intake = ZoiNutrition.getTodayIntake();

        const remainingCal = goals.calories - intake.cal;
        let score = 100;
        let badges = [];
        let warnings = [];

        if (nut.cal <= remainingCal * 0.4) {
            badges.push({ icon: '✅', label: 'Fits your goal', color: 'green' });
        } else if (nut.cal > remainingCal) {
            warnings.push({ icon: '⚠️', label: 'Over daily limit', color: 'red' });
            score -= 30;
        }

        if (nut.protein >= 25) {
            badges.push({ icon: '💪', label: 'High Protein', color: 'blue' });
            if (goals.dietType === 'highProtein') score += 20;
        }
        if (nut.cal <= 350) badges.push({ icon: '🥬', label: 'Light Meal', color: 'green' });
        if (goals.dietType === 'keto' && nut.carbs > 30) {
            warnings.push({ icon: '🚫', label: 'Not Keto', color: 'orange' });
            score -= 20;
        }
        if (nut.fiber >= 5) badges.push({ icon: '🌿', label: 'High Fiber', color: 'green' });
        if (goals.dietType === 'vegan' && item.veg) {
            badges.push({ icon: '🌱', label: 'Vegan Friendly', color: 'green' });
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            nutrition: nut, badges, warnings,
            caloriePercent: Math.round((nut.cal / goals.calories) * 100),
            proteinPercent: Math.round((nut.protein / goals.protein) * 100),
            remainingCal,
            remainingProtein: goals.protein - intake.protein
        };
    },

    getWeeklySummary: () => {
        const stored = JSON.parse(localStorage.getItem('zoiDailyIntake')) || {};
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toDateString();
            days.push({
                label: d.toLocaleDateString('en', { weekday: 'short' }),
                ...(stored[key] || { cal: 0, protein: 0, carbs: 0, fat: 0, items: [] })
            });
        }
        return days;
    }
};

// =========================================================================
// 15. Z.O.I. BACKEND SYNC ENGINE (PHASE 1 INTEGRATION)
// =========================================================================
const ZoiBackendSync = {
    API_URL: (typeof ZOI_CONFIG !== 'undefined' ? ZOI_CONFIG.API_BASE_URL : 'http://localhost:5000/api'),
    
    // Pulls data from the real backend and updates local cache
    pull: async () => {
        try {
            // 1. Fetch real restaurants & menus
            const restRes = await fetch(`${ZoiBackendSync.API_URL}/restaurants`);
            if (restRes.ok) {
                const apiRestaurants = await restRes.json();
                if (apiRestaurants.length > 0) {
                    // Update our DB_RESTAURANTS equivalent format
                    const mappedRestaurants = apiRestaurants.map(r => ({
                        id: r.id.toString(),
                        name: r.name,
                        ownerName: r.ownerName,
                        phone: r.phone,
                        status: r.status,
                        plan: r.plan,
                        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBKO5w3PjAegdWNtmjpyygcoqbWDbb1MMykp1Ra9F3QjtGred4ExZyv6xsp55ec6MQj__XypBAvDihrl8j2HS434CoBWARyYMu14hsj4d-q8o0eBQeff024K-JdssN8pZmm-E1eeoitvTeuVrygnhdtMXo7jW3emz7KKG7vMm4R465g2e1vlL4xNht0rGjjnY4p54Nw9xBRM90IqXs1c0wLTzZiBc-zJUsoX6K2G1uzBH_6v_WyaSD6kXP0dxGcogDA5B5Ck094Qsg", // Placeholder for CDN implementation later
                        tags: r.menus ? [...new Set(r.menus.map(m => m.category))] : ["North Indian"],
                        rating: 4.5,
                        time: "30 min",
                        cost: "₹300 for two",
                        promoted: false,
                        offer: null
                    }));
                    // Overwrite local localStorage with real DB (merging could be better, but we replace for true sync)
                    localStorage.setItem('zoiRest', JSON.stringify(mappedRestaurants));
                    
                    // Also sync menus if they came down
                    const localMenus = typeof DB_MENUS !== 'undefined' ? DB_MENUS : {};
                    apiRestaurants.forEach(r => {
                        if (r.menus && r.menus.length > 0) {
                            localMenus[r.id.toString()] = r.menus.map(m => ({
                                id: m.id,
                                name: m.itemName,
                                price: m.price,
                                desc: "Delicious " + m.itemName,
                                img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3lsPgvpwXtnxK3K9t1j0Wou61_OdbqYwv3pyL5nETlcOgJXJ2g6GdFV0JUgyjvlC1nVmKHYUVapikcMbnwl7NSgukfj51gYjXfb44KXxCqMeDOWHLCZIy5GgEBjrhzXCofqSbK7edixAYOTaP3g5er3inMcfP-8CnPzWZ8b_xBmSqWTryDhHF1TB5udk0V1VWms4RkrnkF7XoTrvLLO48pXdz0KQoYOl_5AByW3GLS1_SZaOlRllWASXz758wndsDFpc5QVg-P7A",
                                veg: m.type === 'Veg',
                                spicy: false
                            }));
                        }
                    });
                    // For now, menus are hardcoded variables in this file, so we can't easily globally overwrite them 
                    // without localStorage, but we lay the groundwork here for Phase 2.
                }
            }

            // 2. Fetch real orders
            const orderRes = await fetch(`${ZoiBackendSync.API_URL}/orders`);
            if (orderRes.ok) {
                const { data } = await orderRes.json();
                if (data && data.length > 0) {
                    const mappedOrders = data.map(o => ({
                        id: o.zoiId,
                        orderId: o.zoiId,
                        restaurantId: o.restaurantId.toString(),
                        restaurant: "Fetched Restaurant",
                        total: o.total,
                        status: o.status,
                        type: o.type,
                        date: new Date(o.createdAt).toLocaleDateString(),
                        time: new Date(o.createdAt).toLocaleTimeString(),
                        items: o.items ? JSON.parse(o.items) : [],
                        payment: 'UPI', 
                        address: o.deliveryAddress,
                        zone: o.zone
                    }));
                    // Overwrite completed/active orders locally
                    localStorage.setItem('zoiCompletedOrders', JSON.stringify(mappedOrders));
                }
            }

            console.log("🟢 Z.O.I. Backend Sync: Data Pulled Successfully");
            
            // Dispatch event so UI elements can softly refresh if needed
            window.dispatchEvent(new Event('zoiBackendSynced'));

        } catch (error) {
            console.warn("🔴 Z.O.I. Backend Sync: Offline Mode Active. Local mock data will be used. Server might be down.", error);
        }
    },
    
    // Pushes orders to the real backend
    pushOrder: async (orderPayload) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            const token = typeof ZoiToken !== 'undefined' ? ZoiToken.get() : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch(`${ZoiBackendSync.API_URL}/orders`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    restaurantId: parseInt(orderPayload.restaurantId) || 1,
                    items: JSON.stringify(orderPayload.items),
                    totalAmount: orderPayload.total,
                    deliveryAddress: orderPayload.address,
                    zone: orderPayload.zone || 'Indiranagar'
                })
            });
            if (res.ok) {
                console.log("🟢 Z.O.I. Backend Sync: Order Pushed Successfully");
            }
        } catch (error) {
            console.warn("🔴 Z.O.I. Backend Sync: Push Failed, order stored locally only.");
        }
    },

    // Initialize WebSockets
    initSockets: () => {
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = "https://cdn.socket.io/4.7.4/socket.io.min.js";
            script.onload = () => ZoiBackendSync.connectSocket();
            document.head.appendChild(script);
        } else {
            ZoiBackendSync.connectSocket();
        }
    },

    connectSocket: () => {
        const socketUrl = typeof ZOI_CONFIG !== 'undefined' ? ZOI_CONFIG.SOCKET_URL : 'http://localhost:5000';
        const socket = io(socketUrl);
        socket.on('connect', () => {
            console.log('🟢 Z.O.I. WebSockets: Connected to sync engine');
        });

        socket.on('new_order', (order) => {
            console.log('⚡ WebSocket: New Order Received', order);
            // Refresh local cache
            ZoiBackendSync.pull();
        });

        socket.on('order_status_update', (order) => {
            console.log('⚡ WebSocket: Order Status Updated', order);
            // Refresh local cache
            ZoiBackendSync.pull();
        });
    }
};

// Auto-trigger sync and sockets on load
setTimeout(() => {
    ZoiBackendSync.pull();
    ZoiBackendSync.initSockets();
}, 1000);

// --- Offline Mode Seed Data for Profile & Support Render ---
if (!localStorage.getItem('zoiCompletedOrders')) {
    const defaultOrders = [
        {
            id: "ORD-9912",
            restaurantId: "101",
            restaurantName: "Spice Symphony",
            customer: "Aditi Rao",
            total: 630,
            status: "Delivered",
            date: new Date(Date.now() - 86400000 * 2).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            items: [{ name: "Chicken Biryani", qty: 1, price: 350 }, { name: "Paneer Tikka", qty: 1, price: 280 }]
        },
        {
            id: "ORD-9908",
            restaurantId: "102",
            restaurantName: "Burger King",
            customer: "Aditi Rao",
            total: 348,
            status: "Delivered",
            date: new Date(Date.now() - 86400000 * 5).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            items: [{ name: "Whopper", qty: 1, price: 199 }, { name: "Chicken Fries", qty: 1, price: 149 }]
        }
    ];
    localStorage.setItem('zoiCompletedOrders', JSON.stringify(defaultOrders));
}
