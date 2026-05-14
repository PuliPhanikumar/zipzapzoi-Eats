/**
 * ZipZapZoi E2E Test Suite — Phase 20
 * Tests all production API routes across Options A-E
 * Run: node e2e_test.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = 'http://localhost:5000';
let authToken = '';
let adminToken = '';
let testUserId = null;
let testOrderId = null;
let testHostelId = null;
let testRoomId = null;
let testHostelerId = null;

const results = { pass: 0, fail: 0, skip: 0, errors: [] };

async function req(method, path, body, token) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token || authToken) headers['Authorization'] = 'Bearer ' + (token || authToken);
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        const r = await fetch(BASE + path, opts);
        const data = await r.json().catch(() => ({}));
        return { status: r.status, ok: r.ok, data };
    } catch(e) {
        return { status: 0, ok: false, data: {}, error: e.message };
    }
}

function test(name, passed, detail = '') {
    const icon = passed ? '✅' : '❌';
    if (passed) { results.pass++; console.log(`  ${icon} ${name}`); }
    else { results.fail++; results.errors.push({ name, detail }); console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`); }
}

function section(name) { console.log(`\n${'═'.repeat(55)}\n  ${name}\n${'═'.repeat(55)}`); }

// ═══════════════════════════════════════
// AUTH TESTS
// ═══════════════════════════════════════
async function testAuth() {
    section('AUTH — Register / Login / Me');
    const email = `e2e_${Date.now()}@zipzapzoi.test`;

    // Register
    const custPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const reg = await req('POST', '/api/auth/register', { name: 'E2E Tester', email, phone: custPhone, password: 'Test@1234', role: 'customer' });
    test('POST /api/auth/register (201)', reg.status === 201 || reg.status === 200, `status=${reg.status}`);
    if (reg.data.token) authToken = reg.data.token;
    if (reg.data.user?.id) testUserId = reg.data.user.id;

    // Login
    const login = await req('POST', '/api/auth/login', { identifier: email, password: 'Test@1234' });
    test('POST /api/auth/login (200)', login.ok || login.status === 200, `status=${login.status}`);
    if (login.data.token) authToken = login.data.token;

    // Me
    const me = await req('GET', '/api/auth/me');
    test('GET /api/auth/me (200)', me.ok && me.data.email === email, `status=${me.status}`);

    // Health
    const health = await req('GET', '/api/health');
    test('GET /api/health (200)', health.ok && (health.data.status === 'ok' || health.data.status === 'OK'), `status=${health.status}`);
}

// ═══════════════════════════════════════
// OPTION A — CUSTOMER ENDPOINTS
// ═══════════════════════════════════════
async function testCustomer() {
    section('OPTION A — Customer Endpoints');

    // Restaurants
    const rests = await req('GET', '/api/restaurants');
    test('GET /api/restaurants', rests.ok, `status=${rests.status} count=${Array.isArray(rests.data)?rests.data.length:'?'}`);

    // Search
    const search = await req('GET', '/api/search?q=pizza');
    test('GET /api/search?q=pizza', search.ok, `status=${search.status}`);

    // Promotions
    const promos = await req('GET', '/api/promotions');
    test('GET /api/promotions', promos.ok, `status=${promos.status}`);

    // Subscriptions
    const subs = await req('GET', '/api/subscriptions');
    test('GET /api/subscriptions', subs.ok, `status=${subs.status}`);

    // Profile
    const profile = await req('GET', '/api/auth/me');
    test('GET /api/auth/me (profile)', profile.ok, `status=${profile.status}`);

    // Orders (history) — expect empty array for new user
    const orders = await req('GET', '/api/orders');
    test('GET /api/orders (history)', orders.ok, `status=${orders.status}`);

    // Support tickets
    const tickets = await req('GET', '/api/support-tickets');
    test('GET /api/support-tickets', tickets.ok, `status=${tickets.status}`);

    // POST feedback
    const fb = await req('POST', '/api/feedback', { type: 'Feature Request', subject: 'E2E Test', message: 'Testing feedback API', rating: 5 });
    test('POST /api/feedback', fb.ok || fb.status === 201, `status=${fb.status}`);

    // Gamification
    const badges = await req('GET', '/api/users/me/badges');
    test('GET /api/users/me/badges', badges.ok, `status=${badges.status}`);

    // Referral
    const ref = await req('GET', '/api/users/me/referral');
    test('GET /api/users/me/referral', ref.ok, `status=${ref.status}`);

    // Place order (minimal)
    const order = await req('POST', '/api/orders', { restaurantId: 1, items: [{ menuItemId: 1, quantity: 1, price: 100 }], totalAmount: 100, deliveryAddress: '123 Test St', paymentMethod: 'cod' });
    test('POST /api/orders (place order)', order.ok || order.status === 201, `status=${order.status}`);
    if (order.data.id || order.data.order?.id) testOrderId = order.data.id || order.data.order?.id;

    // Rider application
    const riderApp = await req('POST', '/api/rider-applications', { name: 'E2E Rider', phone: '9888888888', city: 'Delhi', vehicleType: 'Bike' });
    test('POST /api/rider-applications', riderApp.ok || riderApp.status === 201, `status=${riderApp.status}`);
}

// ═══════════════════════════════════════
// OPTION B — ADMIN ENDPOINTS
// ═══════════════════════════════════════
async function testAdmin() {
    section('OPTION B — Admin Endpoints');

    // Register admin (as customer to pass validation)
    const adminEmail = `admin_e2e_${Date.now()}@zipzapzoi.test`;
    const adminPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const adminReg = await req('POST', '/api/auth/register', { name: 'E2E Admin', email: adminEmail, phone: adminPhone, password: 'Admin@1234', role: 'customer' });
    if (!adminReg.ok) console.log("Admin Registration failed:", adminReg);
    
    // Promote to Super Admin via Prisma
    if (adminReg.data.user?.id) {
        await prisma.user.update({ where: { id: adminReg.data.user.id }, data: { role: 'Super Admin' } });
    }
    
    // Login to get the updated token
    const adminLogin = await req('POST', '/api/auth/login', { identifier: adminEmail, password: 'Admin@1234' });
    adminToken = adminLogin.data.token || authToken;

    // Users
    const users = await req('GET', '/api/users', null, adminToken);
    test('GET /api/users', users.ok, `status=${users.status} count=${Array.isArray(users.data)?users.data.length:'?'}`);

    // Disputes
    const disputes = await req('GET', '/api/disputes', null, adminToken);
    test('GET /api/disputes', disputes.ok, `status=${disputes.status}`);

    // Refunds
    const refunds = await req('GET', '/api/refunds', null, adminToken);
    test('GET /api/refunds', refunds.ok, `status=${refunds.status}`);

    // Feedback (admin view)
    const fbAdmin = await req('GET', '/api/feedback', null, adminToken);
    test('GET /api/feedback (admin)', fbAdmin.ok, `status=${fbAdmin.status}`);

    // Zones
    const zones = await req('GET', '/api/zones', null, adminToken);
    test('GET /api/zones', zones.ok, `status=${zones.status}`);

    // POST zone
    const newZone = await req('POST', '/api/zones', { name: 'E2E Zone', isActive: true, lat: 28.7041, lng: 77.1025, radius: 5 }, adminToken);
    test('POST /api/zones', newZone.ok || newZone.status === 201, `status=${newZone.status}`);

    // Rider applications (admin)
    const riderApps = await req('GET', '/api/rider-applications', null, adminToken);
    test('GET /api/rider-applications', riderApps.ok, `status=${riderApps.status}`);

    // Admin analytics
    const analytics = await req('GET', '/api/admin/analytics/live', null, adminToken);
    test('GET /api/admin/analytics/live', analytics.ok, `status=${analytics.status}`);

    // System health
    const health = await req('GET', '/api/health');
    test('GET /api/health', health.ok, `status=${health.status} db=${health.data.database}`);
}

// ═══════════════════════════════════════
// OPTION C — STANDALONE / RESTAURANT
// ═══════════════════════════════════════
async function testStandalone() {
    section('OPTION C — Standalone Restaurant Endpoints');

    // Create test restaurant if not exists
    const restEmail = `rest_e2e_${Date.now()}@zipzapzoi.test`;
    const restPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const restReg = await req('POST', '/api/auth/register', { name: 'E2E Restaurant', email: restEmail, phone: restPhone, password: 'Rest@1234', role: 'restaurant_owner', restaurantName: 'E2E Kitchen' });
    let restToken = restReg.data.token || authToken;

    // Restaurants
    const rests = await req('GET', '/api/restaurants');
    test('GET /api/restaurants', rests.ok, `status=${rests.status}`);

    let restId = Array.isArray(rests.data) && rests.data.length > 0 ? rests.data[0].id : 1;

    // Partner dashboard
    const dash = await req('GET', `/api/partner/dashboard/${restId}`, null, restToken);
    test(`GET /api/partner/dashboard/${restId}`, dash.ok, `status=${dash.status}`);

    // Partner orders
    const orders = await req('GET', `/api/partner/orders/${restId}`, null, restToken);
    test(`GET /api/partner/orders/${restId}`, orders.ok, `status=${orders.status}`);

    // Partner menu
    const menu = await req('GET', `/api/partner/menu/${restId}`, null, restToken);
    test(`GET /api/partner/menu/${restId}`, menu.ok, `status=${menu.status}`);

    // Restaurant rooms/tables
    const tables = await req('GET', `/api/restaurants/${restId}/tables`, null, restToken);
    test(`GET /api/restaurants/${restId}/tables`, tables.ok, `status=${tables.status}`);

    // Inventory
    const inv = await req('GET', `/api/inventory/${restId}`, null, restToken);
    test(`GET /api/inventory/${restId}`, inv.ok, `status=${inv.status}`);

    // Menu review
    const reviews = await req('GET', `/api/reviews/all?restaurantId=${restId}`);
    test(`GET /api/reviews/all?restaurantId=${restId}`, reviews.ok, `status=${reviews.status}`);

    // Notifications test
    const notif = await req('POST', '/api/notifications/test', { title: 'E2E Test', body: 'API test notification' }, adminToken);
    test('POST /api/notifications/test', notif.ok, `status=${notif.status}`);
}

// ═══════════════════════════════════════
// OPTION D — HOSTEL ENDPOINTS
// ═══════════════════════════════════════
async function testHostel() {
    section('OPTION D — Hostel Management Endpoints');

    // GET hostels (might be empty)
    const hostels = await req('GET', '/api/hostels');
    test('GET /api/hostels', hostels.ok, `status=${hostels.status}`);

    // POST hostel
    const newHostel = await req('POST', '/api/hostels', { name: 'E2E Hostel', address: '123 Test Road', city: 'Delhi', phone: '9111111111', type: 'Mixed', totalRooms: 10 });
    test('POST /api/hostels', newHostel.ok || newHostel.status === 201, `status=${newHostel.status}`);
    if (newHostel.data.id) testHostelId = newHostel.data.id;

    if (!testHostelId) { console.log('  [SKIP] Hostel sub-tests — no hostelId'); results.skip += 8; return; }

    // POST room
    const newRoom = await req('POST', `/api/hostels/${testHostelId}/rooms`, { roomNumber: 'E2E-101', floor: 1, type: 'Double', capacity: 2, rent: 5000 });
    test('POST /api/hostels/:id/rooms', newRoom.ok || newRoom.status === 201, `status=${newRoom.status}`);
    if (newRoom.data.id) testRoomId = newRoom.data.id;

    // GET rooms
    const rooms = await req('GET', `/api/hostels/${testHostelId}/rooms`);
    test('GET /api/hostels/:id/rooms', rooms.ok, `status=${rooms.status} count=${Array.isArray(rooms.data)?rooms.data.length:'?'}`);

    // POST hosteler
    const newHosteler = await req('POST', `/api/hostels/${testHostelId}/hostelers`, { name: 'E2E Student', phone: '9222222222', email: 'student@e2e.test', plan: 'Monthly', roomId: testRoomId });
    test('POST /api/hostels/:id/hostelers', newHosteler.ok || newHosteler.status === 201, `status=${newHosteler.status}`);
    if (newHosteler.data.id) testHostelerId = newHosteler.data.id;

    // GET hostelers
    const hostelers = await req('GET', `/api/hostels/${testHostelId}/hostelers`);
    test('GET /api/hostels/:id/hostelers', hostelers.ok, `status=${hostelers.status}`);

    // POST billing
    const bill = await req('POST', `/api/hostels/${testHostelId}/billing`, { hostelerId: testHostelerId, month: '2025-05', rentAmount: 5000, messAmount: 2000 });
    test('POST /api/hostels/:id/billing', bill.ok || bill.status === 201, `status=${bill.status}`);

    // GET billing
    const billing = await req('GET', `/api/hostels/${testHostelId}/billing`);
    test('GET /api/hostels/:id/billing', billing.ok, `status=${billing.status}`);

    // POST gatepass
    const pass = await req('POST', `/api/hostels/${testHostelId}/gatepasses`, { hostelerId: testHostelerId, purpose: 'Home Visit', destination: 'Parents Home' });
    test('POST /api/hostels/:id/gatepasses', pass.ok || pass.status === 201, `status=${pass.status}`);

    // POST complaint
    const complaint = await req('POST', `/api/hostels/${testHostelId}/complaints`, { hostelerId: testHostelerId, category: 'WiFi', subject: 'E2E Test Complaint', message: 'Testing complaint API', priority: 'Low' });
    test('POST /api/hostels/:id/complaints', complaint.ok || complaint.status === 201, `status=${complaint.status}`);

    // POST expense
    const expense = await req('POST', `/api/hostels/${testHostelId}/expenses`, { category: 'Utilities', title: 'E2E Electricity Bill', amount: 3500, paymentMode: 'UPI' });
    test('POST /api/hostels/:id/expenses', expense.ok || expense.status === 201, `status=${expense.status}`);

    // POST notice
    const notice = await req('POST', `/api/hostels/${testHostelId}/notices`, { title: 'E2E Notice', message: 'Test notice from E2E suite', category: 'General', pinned: false });
    test('POST /api/hostels/:id/notices', notice.ok || notice.status === 201, `status=${notice.status}`);

    // GET analytics
    const analytics = await req('GET', `/api/hostels/${testHostelId}/analytics`);
    test('GET /api/hostels/:id/analytics', analytics.ok && analytics.data.totalRooms !== undefined, `status=${analytics.status} rooms=${analytics.data.totalRooms}`);

    // POST laundry
    const laundry = await req('POST', `/api/hostels/${testHostelId}/laundry`, { hostelerId: testHostelerId, items: [{ type: 'Shirt', qty: 3 }, { type: 'Pants', qty: 2 }], totalItems: 5, charges: 150 });
    test('POST /api/hostels/:id/laundry', laundry.ok || laundry.status === 201, `status=${laundry.status}`);

    // POST visitor
    const visitor = await req('POST', `/api/hostels/${testHostelId}/visitors`, { visitorName: 'E2E Parent', phone: '9333333333', purpose: 'Parent Visit', status: 'In' });
    test('POST /api/hostels/:id/visitors', visitor.ok || visitor.status === 201, `status=${visitor.status}`);

    // GET mess
    const mess = await req('GET', `/api/hostels/${testHostelId}/mess`);
    test('GET /api/hostels/:id/mess', mess.ok, `status=${mess.status}`);

    // Registration
    const reg = await req('POST', '/api/hostels/register', { hostelId: testHostelId, name: 'E2E Walk-in', phone: '9444444444', plan: 'Monthly' });
    test('POST /api/hostels/register', reg.ok || reg.status === 201, `status=${reg.status}`);
}

// ═══════════════════════════════════════
// OPTION E — RESTAURANT & RIDER
// ═══════════════════════════════════════
async function testRestaurantRider() {
    section('OPTION E — Restaurant & Rider Endpoints');

    // Restaurant applications
    const apps = await req('GET', '/api/restaurant-applications', null, adminToken);
    test('GET /api/restaurant-applications', apps.ok, `status=${apps.status}`);

    // POST application
    const newApp = await req('POST', '/api/restaurant-applications', { restaurantName: 'E2E Kitchen', ownerName: 'E2E Owner', phone: '9555555555', city: 'Delhi', cuisine: 'Multi' });
    test('POST /api/restaurant-applications', newApp.ok || newApp.status === 201, `status=${newApp.status}`);

    // CMS
    const cms = await req('GET', '/api/cms');
    test('GET /api/cms', cms.ok, `status=${cms.status}`);

    // Rider dashboard
    const riderDash = await req('GET', '/api/rider/dashboard');
    test('GET /api/rider/dashboard', riderDash.ok || riderDash.status === 401 || riderDash.status === 404, `status=${riderDash.status}`);

    // Reviews
    const reviews = await req('GET', '/api/reviews/all');
    test('GET /api/reviews/all', reviews.ok, `status=${reviews.status}`);
}

// ═══════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════
async function runAll() {
    console.log('\n' + '█'.repeat(55));
    console.log('  ZIPZAPZOI E2E TEST SUITE — Phase 20');
    console.log('  Target: ' + BASE);
    console.log('█'.repeat(55));

    const start = Date.now();
    await testAuth();
    await testCustomer();
    await testAdmin();
    await testStandalone();
    await testHostel();
    await testRestaurantRider();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n' + '═'.repeat(55));
    console.log('  TEST RESULTS');
    console.log('═'.repeat(55));
    console.log(`  ✅ PASS: ${results.pass}`);
    console.log(`  ❌ FAIL: ${results.fail}`);
    console.log(`  ⏭️  SKIP: ${results.skip}`);
    console.log(`  ⏱️  Time: ${elapsed}s`);
    console.log(`  📊 Score: ${results.pass}/${results.pass + results.fail} (${Math.round(results.pass/(results.pass+results.fail)*100)}%)`);

    if (results.errors.length) {
        console.log('\n  FAILURES:');
        results.errors.forEach(e => console.log(`    ❌ ${e.name}${e.detail ? ' — '+e.detail : ''}`));
    }
    console.log('═'.repeat(55) + '\n');
}

runAll().catch(console.error);
