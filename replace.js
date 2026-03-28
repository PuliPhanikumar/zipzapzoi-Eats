const fs = require('fs');

let content = fs.readFileSync('restaurant_live_orders_kds.html', 'utf8');

const render_board_replacement =         function renderBoard() {
            let liveOrders = typeof ZoiPartnerOrders !== 'undefined' ? ZoiPartnerOrders.getLiveOrders() : [];

            ['incoming', 'preparing', 'ready'].forEach(c => document.getElementById('col-' + c).innerHTML = "");

            let incomingCount = 0, preparingCount = 0, readyCount = 0;
            let displayOrders = [];

            liveOrders.forEach(o => {
                let displayType = 'incoming';
                if (['Accepted', 'Preparing', 'Cooking'].includes(o.status)) displayType = 'preparing';
                else if (['Ready', 'Out for Delivery'].includes(o.status)) displayType = 'ready';

                // Monitor Unacknowledged Ready orders
                if (displayType === 'ready') unacknowledgedOrders.add(o.id);
                else unacknowledgedOrders.delete(o.id);

                let elapsedMins = 0;
                try {
                    const ticketDate = new Date(o.timestamp || o.time || o.date || new Date());
                    elapsedMins = Math.floor((new Date() - ticketDate) / 60000);
                    if (elapsedMins < 0) elapsedMins += 1440; // overnight fixes
                } catch (e) { }

                const itemCount = o.items ? o.items.length : 1;
                const estPrepMins = o.estPrepMins || (10 + (itemCount - 1) * 3);
                let slaStatus = 'on-time';
                if (elapsedMins > estPrepMins) slaStatus = 'critical';
                else if (elapsedMins > estPrepMins * 0.7) slaStatus = 'delayed';

                displayOrders.push({
                    id: o.id,
                    type: displayType.charAt(0).toUpperCase() + displayType.slice(1),
                    time: elapsedMins,
                    mode: o.mode || "Online",
                    items: (o.items || []).map(i => ({ qty: i.qty || 1, n: i.name, mods: i.mods || [] })),
                    price: o.total,
                    driver: o.riderName || o.meta || "Searching...",
                    placedAt: o.timestamp || o.time,
                    estPrepMins: estPrepMins,
                    sla: slaStatus,
                    instructions: o.instructions || '',
                    riderAssigned: !!o.riderAssigned,
                    riderAtRestaurant: !!o.riderAtRestaurant,
                    displayType: displayType,
                    isSync: true // Engine handles all syncing
                });
            });

            // Render all
            perfStats.activeCount = 0;
            displayOrders.forEach(kdsOrder => {
                if (kdsOrder.displayType === 'incoming') {
                    incomingCount++;
                    if (_lastSeenOrderId !== kdsOrder.id) {
                        _lastSeenOrderId = kdsOrder.id;
                        playAlert();
                        announce("new");
                        startAutoAcceptTimer();
                    }
                }
                if (kdsOrder.displayType === 'preparing') { preparingCount++; perfStats.activeCount++; }
                if (kdsOrder.displayType === 'ready') readyCount++;
                if (kdsOrder.displayType === 'incoming') perfStats.activeCount++;

                document.getElementById('col-' + kdsOrder.displayType).innerHTML += createCard(kdsOrder);
            });

            document.getElementById('count-incoming').innerText = incomingCount;
            document.getElementById('count-preparing').innerText = preparingCount;
            document.getElementById('count-ready').innerText = readyCount;
            updateStatsUI();
            renderSummary();
        };

// Using exact string replacements with indexOf / substring
const startRB = content.indexOf('function renderBoard() {');
const endRB = content.indexOf('function simulateNewOrder() {');
if (startRB !== -1 && endRB !== -1) {
    // Note: leave some trailing logic like // Override Simulate to do nothing or warn untouched
    const cutEnd = content.lastIndexOf('}', endRB) + 1;
    content = content.substring(0, startRB) + render_board_replacement + '\n\n' + content.substring(cutEnd);
}

const sim_replacement =         function simulateNewOrder() {
            if (!isOnline) return alert("Kitchen is Offline!");
            const newId = Math.floor(Math.random() * 1000) + 9000;
            const modes = ["Dine-In", "Online", "Takeaway"];
            const randMode = modes[Math.floor(Math.random() * modes.length)];

            // Global Sync override for sim using actual Customer structure
            const currentRestId = localStorage.getItem('zoiPartnerRestId') || "101";
            let allOrders = JSON.parse(localStorage.getItem('zoiOrderHistory') || '[]');
            
            allOrders.unshift({
                id: "SIM-" + newId,
                status: "Pending",
                restaurantId: currentRestId,
                total: 150,
                mode: randMode,
                timestamp: new Date().toISOString(),
                items: [{ name: "Veg Burger", qty: 1 }],
                instructions: "Simulation generated."
            });
            localStorage.setItem('zoiOrderHistory', JSON.stringify(allOrders));

            renderBoard();
            playAlert(null, randMode); 
            announce("new");
        };
const startSIM = content.indexOf('function simulateNewOrder() {');
const endSIM = content.indexOf('function acceptOrder(id) {');
if (startSIM !== -1 && endSIM !== -1) {
    content = content.substring(0, startSIM) + sim_replacement + '\n\n' + content.substring(endSIM);
}

const acc_replacement =         function acceptOrder(id) {
            clearAutoAcceptTimer();
            if (typeof ZoiPartnerOrders !== 'undefined') {
                ZoiPartnerOrders.updateOrderStatus(id, 'Preparing');
            }

            localStorage.setItem('kds_accept_time_' + id, new Date().toISOString());
            renderBoard();
            announce("accept");
        };
const startACC = content.indexOf('function acceptOrder(id) {');
const endACC = content.indexOf('function markReady(id) {');
if (startACC !== -1 && endACC !== -1) {
    content = content.substring(0, startACC) + acc_replacement + '\n\n' + content.substring(endACC);
}

const req_replacement =         function markReady(id) {
            if (typeof ZoiPartnerOrders !== 'undefined') {
                ZoiPartnerOrders.updateOrderStatus(id, 'Ready');
            }

            const acceptTime = localStorage.getItem('kds_accept_time_' + id);
            let prepMins = 0;
            if (acceptTime) {
                prepMins = Math.max(1, Math.round((new Date() - new Date(acceptTime)) / 60000));
                perfStats.prepTimes.push(prepMins);
                perfStats.totalOrders++;
                savePerfStats();
            }
            localStorage.setItem('kds_ready_time_' + id, new Date().toISOString());

            renderBoard();
            announce("ready");
        };
const startRDY = content.indexOf('function markReady(id) {');
const endRDY = content.indexOf('function markPickedUp(id) {');
if (startRDY !== -1 && endRDY !== -1) {
    content = content.substring(0, startRDY) + req_replacement + '\n\n' + content.substring(endRDY);
}

const pck_replacement =         function markPickedUp(id) {
            if (typeof ZoiPartnerOrders !== 'undefined') {
                ZoiPartnerOrders.updateOrderStatus(id, 'Delivered');
            }
            unacknowledgedOrders.delete(id);
            renderBoard();
            announce("picked");
        };
const startPCK = content.indexOf('function markPickedUp(id) {');
const endPCK = content.indexOf('function startAutoAcceptTimer() {', startPCK);
if (startPCK !== -1 && endPCK !== -1) {
    // Need to find the end of the action block
    const cutEnd = content.lastIndexOf('}', endPCK - 1) + 1;
    content = content.substring(0, startPCK) + pck_replacement + '\n\n        // --- AUTO-ACCEPT TIMER ---\n' + content.substring(endPCK);
}

// Replace confirmReject
const rej_replacement =         function confirmReject(reason) {
            if (typeof ZoiPartnerOrders !== 'undefined') {
                ZoiPartnerOrders.updateOrderStatus(rejectId, 'Cancelled');
            }
            closeModal();
            renderBoard();
            announce("reject");
        };
const startREJ = content.indexOf('function confirmReject(reason) {');
const endREJ = content.indexOf('function updateStatsUI() {');
if (startREJ !== -1 && endREJ !== -1) {
    const cutEnd = content.lastIndexOf('}', endREJ - 1) + 1;
    content = content.substring(0, startREJ) + rej_replacement + '\n\n' + content.substring(cutEnd);
}

fs.writeFileSync('restaurant_live_orders_kds.html', content, 'utf8');
console.log("Replaced successfully!");
