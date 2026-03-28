const fs = require('fs');

let s = fs.readFileSync('global_sidebar.js', 'utf8');

const standaloneHtml = `<aside class="w-64 bg-surface border-r border-border flex flex-col z-30 hidden md:flex shrink-0">
    <div class="p-6 flex items-center gap-3">
        <div class="size-10 bg-primary rounded-xl flex items-center justify-center text-black font-black text-xl shadow-[0_0_15px_rgba(242,127,13,0.4)]">Z</div>
        <div>
            <h1 class="font-bold text-lg tracking-tight">Standalone POS</h1>
            <p class="text-[10px] text-gray-500 uppercase tracking-widest" id="sidebar-rest-name">Your Restaurant</p>
        </div>
    </div>

    <nav class="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
        <a href="standalone_restaurant_dashboard.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">dashboard</span> Dashboard</a>

        <div class="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Front of House</div>
        <a href="standalone_pos_terminal.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">point_of_sale</span> POS Terminal</a>
        <a href="standalone_table_management.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">table_restaurant</span> Floor Plan</a>
        <a href="standalone_kds.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">cooking</span> KDS (Kitchen)</a>

        <div class="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Operations</div>
        <a href="standalone_menu_manager.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">restaurant_menu</span> Menu Manager</a>

        <div class="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Management</div>
        <a href="standalone_inventory.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">inventory_2</span> Inventory</a>
        <a href="standalone_staff.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">groups</span> Staff</a>
        <a href="standalone_financials.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">account_balance_wallet</span> Financials</a>

        <div class="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">System</div>
        <a href="standalone_settings.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">settings</span> Settings</a>
    </nav>

    <div class="p-4 border-t border-border">
        <button onclick="handleLogout()" class="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
            <span class="material-symbols-outlined">logout</span> <span class="text-sm font-bold">Log Out</span>
        </button>
    </div>
</aside>`.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

if (!s.includes('standalone_restaurant_sidebar.html')) {
    s = s.replace(/};\s*function injectGlobalSidebar/m,
        `    'standalone_restaurant_sidebar.html': "${standaloneHtml}"\n};\n\nfunction injectGlobalSidebar`);
}

if (!s.includes("currentFilename.startsWith('standalone_')")) {
    s = s.replace(/else if \(currentFilename\.startsWith\('restaurant'\)\) templateName = 'restaurant_partner_sidebar\.html';/,
        `else if (currentFilename.startsWith('standalone_')) templateName = 'standalone_restaurant_sidebar.html';\n    else if (currentFilename.startsWith('restaurant')) templateName = 'restaurant_partner_sidebar.html';`);
}

fs.writeFileSync('global_sidebar.js', s);
console.log('Sidebar injected successfully.');
