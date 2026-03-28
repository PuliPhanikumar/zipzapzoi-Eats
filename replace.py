import re

with open('restaurant management dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace updateDashboardMetrics
updateDash_replacement = '''        function updateDashboardMetrics() {
            if (typeof ZoiPartnerDashboard === 'undefined') return;

            const metrics = ZoiPartnerDashboard.getMetrics();
            
            const salesEl = document.getElementById('stat-sales');
            const prevSales = salesEl.innerText;
            const newSales = "₹" + metrics.revenueToday.toLocaleString();

            if (prevSales !== newSales) {
                salesEl.innerText = newSales;
                salesEl.classList.add('text-success');
                setTimeout(() => salesEl.classList.remove('text-success'), 1000);
            }

            // Total active orders + past today
            const totalOrders = metrics.completedToday + metrics.liveOrders;
            document.getElementById('stat-orders').innerText = totalOrders;
            document.getElementById('stat-active-orders-text').innerText = metrics.liveOrders + " Live Orders";

            renderDashboardOrders();
        }'''
content = re.sub(r'        function updateDashboardMetrics\(\) \{.*?(?=        // === 3\. NOTIFICATIONS ===)', updateDash_replacement + '\n\n', content, flags=re.DOTALL)


# Replace checkLiveOrders
checkLiveOrders_replacement = '''        function checkLiveOrders() {
            if (typeof ZoiPartnerOrders === 'undefined') return;
            const liveOrders = ZoiPartnerOrders.getLiveOrders();

            const newOrder = liveOrders.find(o => o.status === 'Pending' || o.status === 'placed');
            if (newOrder && !_seenNewOrders.has(newOrder.id)) {
                _seenNewOrders.add(newOrder.id);
                showIncomingOrderModal(newOrder);
            }
            renderDashboardOrders();
        }
        let _seenNewOrders = new Set();'''
content = re.sub(r'        function checkLiveOrders\(\) \{.*?(?=        // Inject Modal HTML dynamically if not present)', checkLiveOrders_replacement + '\n\n', content, flags=re.DOTALL)


# Replace renderDashboardOrders and friends
renderDashOrders_replacement = '''        // 3. UI UPDATES
        function renderDashboardOrders() {
            if (typeof ZoiPartnerOrders === 'undefined') return;
            const liveOrders = ZoiPartnerOrders.getLiveOrders();
            const liveContainer = document.getElementById('live-orders-container');
            
            if (!liveContainer) return;

            if (liveOrders.length === 0) {
                liveContainer.innerHTML = <div class="text-gray-500 text-sm italic py-4 text-center border border-dashed border-gray-700 rounded-xl">No live orders at the moment.</div>;
                return;
            }

            liveContainer.innerHTML = "";
            liveOrders.forEach(order => {
                let statusText = order.status;
                let statusColor = "blue-400";
                let iconColor = "primary";
                let bgIconColor = "primary/20";
                
                if (['Ready', 'Out for Delivery'].includes(order.status)) {
                    statusColor = "green-500";
                    iconColor = "green-500";
                    bgIconColor = "green-500/20";
                } else if (['Pending', 'placed'].includes(order.status)) {
                    statusText = "New Order";
                    statusColor = "orange-500";
                }

                const itemsStr = (order.items || []).map(i => ${i.qty}x ).join(', ');

                liveContainer.innerHTML += 
                    <div class="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer group mb-2"
                        onclick="window.location.href='restaurant_live_orders_kds.html'">
                        <div class="flex items-center gap-4">
                            <div class="size-10 rounded-lg bg- text- flex items-center justify-center font-bold text-xs">
                                #</div>
                            <div>
                                <h4 class="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[400px]"></h4>
                                <p class="text-xs text-gray-500"> • <span class="text-"></span></p>
                            </div>
                        </div>
                        <span class="material-symbols-outlined text-gray-600 group-hover:text-white">chevron_right</span>
                    </div>
                ;
            });
        }

        function acceptOrder() {
            if (typeof ZoiPartnerOrders !== 'undefined' && currentModalOrder) {
                ZoiPartnerOrders.updateOrderStatus(currentModalOrder.id, 'Preparing');
            }
            document.getElementById('incoming-order-modal').classList.add('hidden');
            window.location.href = 'restaurant_live_orders_kds.html';
        }

        function markReady(orderId) {
            if (typeof ZoiPartnerOrders !== 'undefined') {
                ZoiPartnerOrders.updateOrderStatus(orderId, 'Ready');
            }
            renderDashboardOrders();
        }

        function rejectOrder() {
            if (typeof ZoiPartnerOrders !== 'undefined' && currentModalOrder) {
                ZoiPartnerOrders.updateOrderStatus(currentModalOrder.id, 'Cancelled');
            }
            document.getElementById('incoming-order-modal').classList.add('hidden');
            renderDashboardOrders();
        }
        let currentModalOrder = null;'''

content = re.sub(r'        // 3\. UI UPDATES.*?        function rejectOrder\(\) \{.*?(?=\s*</script>\s*<script src="js/zoi_ai_assistant\.js">)', renderDashOrders_replacement + '\n\n', content, flags=re.DOTALL)

# Ensure showIncomingOrderModal sets currentModalOrder
content = content.replace(
    "document.getElementById('modal-order-total').innerText = order.total;",
    "document.getElementById('modal-order-total').innerText = order.total;\n            currentModalOrder = order;"
)

with open('restaurant management dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced easily via python script.")
