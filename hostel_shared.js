/**
 * Zoi Hostel Ecosystem - Shared Utilities
 * Provides LocalStorage (ZoiDB) wrappers and dynamic UI Toast components
 */

const ZoiDB = {
    /**
     * Get parsed JSON from localStorage or fallback to default
     */
    get: function (key, fallback = []) {
        try {
            const data = localStorage.getItem('zoi_' + key);
            return data ? JSON.parse(data) : fallback;
        } catch (e) {
            console.error('ZoiDB Read Error:', e);
            return fallback;
        }
    },

    /**
     * Stringify JSON and save to localStorage
     */
    set: function (key, value) {
        try {
            localStorage.setItem('zoi_' + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('ZoiDB Write Error:', e);
            return false;
        }
    },

    /**
     * Clear specific key or all keys
     */
    clear: function (key = null) {
        if (key) localStorage.removeItem('zoi_' + key);
        else {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('zoi_')) localStorage.removeItem(k);
            });
        }
    }
};

/**
 * Modern Glassmorphism Toast Notification
 * @param {string} msg - The notification message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(msg, type = 'info') {
    // 1. Create or get container
    let container = document.getElementById('zoi-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'zoi-toast-container';
        container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none items-end max-w-sm';
        document.body.appendChild(container);
    }

    // 2. Define styling logic based on type
    const colors = {
        success: { border: 'border-green-500/30', bg: 'bg-green-500/10', icon: 'check_circle', iconColor: 'text-green-400' },
        error: { border: 'border-red-500/30', bg: 'bg-red-500/10', icon: 'error', iconColor: 'text-red-400' },
        warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'warning', iconColor: 'text-amber-400' },
        info: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: 'info', iconColor: 'text-blue-400' }
    };
    const style = colors[type] || colors.info;

    // 3. Build the toast element
    const toast = document.createElement('div');
    // Using bouncy-card physics manually + slide in animation style
    toast.className = `glass-panel flex items-center gap-3 p-3.5 pr-6 ${style.border} ${style.bg} transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto backdrop-blur-xl shadow-2xl rounded-2xl border`;

    toast.innerHTML = `
        <div class="h-8 w-8 rounded-full ${style.bg.replace('10', '20')} flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined ${style.iconColor} text-sm">${style.icon}</span>
        </div>
        <p class="text-sm font-semibold text-white tracking-wide leading-tight">${msg}</p>
        <button class="ml-auto text-gray-400 hover:text-white transition-colors p-1" onclick="this.parentElement.remove()">
            <span class="material-symbols-outlined text-xs">close</span>
        </button>
    `;

    // 4. Append and Animate In
    container.appendChild(toast);

    // Trigger reflow to ensure the transition plays
    void toast.offsetHeight;

    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    // 5. Auto Remove
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}
