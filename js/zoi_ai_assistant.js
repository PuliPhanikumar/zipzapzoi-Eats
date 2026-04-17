/**
 * ZipZapZoi Eats — Zoi AI Chat Assistant
 * ========================================
 * Self-contained floating chatbot widget for all customer pages.
 * No external API needed — uses local db_simulation.js data.
 * 
 * Just add: <script src="js/zoi_ai_assistant.js"></script>
 */

(function () {
    'use strict';

    // ─── STYLES ─────────────────────────────────────────────
    const STYLES = `
    #zoi-ai-fab {
        position: fixed; bottom: 24px; right: 24px; z-index: 9998;
        width: 64px; height: 64px; border-radius: 50%;
        background: linear-gradient(135deg, #00f0ff 0%, #7c3aed 50%, #ff00ff 100%);
        border: 3px solid rgba(0,240,255,0.4); cursor: pointer;
        box-shadow: 0 8px 32px rgba(0,240,255,0.4), 0 0 60px rgba(124,58,237,0.2), inset 0 0 20px rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        animation: zoi-3d-bounce 2s ease-in-out infinite, zoi-glow-ring 3s ease-in-out infinite;
        transform-style: preserve-3d; perspective: 800px;
        overflow: hidden;
    }
    #zoi-ai-fab:hover {
        transform: scale(1.15) rotateY(10deg) rotateX(-5deg);
        box-shadow: 0 12px 48px rgba(0,240,255,0.6), 0 0 80px rgba(255,0,255,0.3);
        border-color: #ff00ff;
    }
    #zoi-ai-fab img { width: 100%; height: 100%; object-fit: cover; filter: drop-shadow(0 0 4px rgba(0,240,255,0.5)); transition: transform 0.3s; }
    #zoi-ai-fab:hover img { transform: scale(1.1); }
    #zoi-ai-fab .zoi-fab-badge {
        position: absolute; top: -2px; right: -2px; width: 18px; height: 18px;
        background: #ef4444; border-radius: 50%; border: 2px solid #0a0314;
        font-size: 10px; font-weight: 800; color: #fff;
        display: flex; align-items: center; justify-content: center;
        animation: zoi-bounce 0.5s ease;
    }
    @keyframes zoi-glow-ring {
        0%, 100% { box-shadow: 0 8px 32px rgba(0,240,255,0.4), 0 0 0 0 rgba(0,240,255,0.3); }
        50% { box-shadow: 0 8px 32px rgba(0,240,255,0.4), 0 0 0 12px rgba(0,240,255,0); }
    }
    @keyframes zoi-3d-bounce {
        0%, 100% { transform: translateY(0) rotateX(0deg) scale(1); }
        25% { transform: translateY(-12px) rotateX(8deg) scale(1.05); }
        50% { transform: translateY(0) rotateX(0deg) scale(1); }
        75% { transform: translateY(-6px) rotateX(4deg) scale(1.02); }
    }
    @keyframes zoi-bounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
    /* AI Powered floating label */
    #zoi-ai-label {
        position: fixed; bottom: 100px; right: 24px; z-index: 9997;
        background: linear-gradient(135deg, #0a0314 0%, #1a0b36 100%);
        border: 1px solid #00f0ff; border-radius: 12px;
        padding: 6px 14px; display: flex; align-items: center; gap: 6px;
        box-shadow: 0 4px 20px rgba(0,240,255,0.3);
        animation: zoi-label-float 3s ease-in-out infinite;
        pointer-events: none;
    }
    #zoi-ai-label span.label-icon { font-size: 14px; }
    #zoi-ai-label span.label-text {
        font-size: 11px; font-weight: 800; color: #00f0ff;
        font-family: 'Quicksand', sans-serif; letter-spacing: 0.5px;
        text-shadow: 0 0 8px rgba(0,240,255,0.4);
    }
    @keyframes zoi-label-float {
        0%, 100% { transform: translateY(0); opacity: 1; }
        50% { transform: translateY(-4px); opacity: 0.85; }
    }

    #zoi-ai-panel {
        position: fixed; bottom: 96px; right: 24px; z-index: 9999;
        width: 380px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 120px);
        background: #0a0314; border: 1px solid #3c1e6e;
        border-radius: 20px; box-shadow: 0 12px 48px rgba(0,0,0,0.6);
        display: none; flex-direction: column; overflow: hidden;
        font-family: 'Quicksand','Nunito','Plus Jakarta Sans',sans-serif;
        animation: zoi-slide-up 0.35s cubic-bezier(.34,1.56,.64,1);
    }
    #zoi-ai-panel.open { display: flex; }
    @keyframes zoi-slide-up {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .zoi-chat-header {
        background: linear-gradient(135deg, #1a0b36 0%, #0a0314 100%);
        padding: 16px 18px; display: flex; align-items: center; gap: 12px;
        border-bottom: 1px solid #3c1e6e; flex-shrink: 0;
    }
    .zoi-chat-header .zoi-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #00f0ff, #7c3aed);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0;
    }
    .zoi-chat-header .zoi-info h4 {
        color: #fff; font-size: 15px; font-weight: 700; margin: 0;
    }
    .zoi-chat-header .zoi-info p {
        color: #00f0ff; font-size: 11px; margin: 2px 0 0; font-weight: 600;
        display: flex; align-items: center; gap: 4px;
    }
    .zoi-chat-header .zoi-info p::before {
        content: ''; width: 6px; height: 6px; border-radius: 50%;
        background: #00f0ff; animation: zoi-blink 1.5s infinite;
    }
    @keyframes zoi-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .zoi-chat-close {
        margin-left: auto; background: rgba(255,255,255,0.1); border: none;
        color: #b4a5d8; width: 32px; height: 32px; border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 18px; transition: all 0.2s;
    }
    .zoi-chat-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

    .zoi-chat-body {
        flex: 1; overflow-y: auto; padding: 16px; display: flex;
        flex-direction: column; gap: 12px;
        scrollbar-width: thin; scrollbar-color: #3c1e6e #0a0314;
    }
    .zoi-chat-body::-webkit-scrollbar { width: 5px; }
    .zoi-chat-body::-webkit-scrollbar-track { background: transparent; }
    .zoi-chat-body::-webkit-scrollbar-thumb { background: #3c1e6e; border-radius: 4px; }

    .zoi-msg {
        max-width: 85%; padding: 12px 16px; border-radius: 16px;
        font-size: 13px; line-height: 1.5; animation: zoi-msg-in 0.3s ease;
    }
    @keyframes zoi-msg-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .zoi-msg.bot {
        align-self: flex-start; background: #1a0b36; color: #e8e0f0;
        border-bottom-left-radius: 4px; border: 1px solid #3c1e6e;
    }
    .zoi-msg.user {
        align-self: flex-end; background: linear-gradient(135deg, #00f0ff, #0099aa);
        color: #0a0314; font-weight: 600; border-bottom-right-radius: 4px;
    }
    .zoi-msg .zoi-tag {
        display: inline-block; background: #00f0ff22; color: #00f0ff;
        font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 8px;
        margin: 4px 4px 0 0; cursor: pointer; border: 1px solid #00f0ff33;
        transition: all 0.2s;
    }
    .zoi-msg .zoi-tag:hover { background: #00f0ff44; }
    .zoi-msg .zoi-card {
        background: #0a0314; border: 1px solid #3c1e6e; border-radius: 12px;
        padding: 10px 14px; margin-top: 8px; display: flex; align-items: center; gap: 10px;
        cursor: pointer; transition: border-color 0.2s;
    }
    .zoi-msg .zoi-card:hover { border-color: #00f0ff; }
    .zoi-msg .zoi-card-img {
        width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
    }
    .zoi-msg .zoi-card-info { flex: 1; }
    .zoi-msg .zoi-card-info h5 { color: #fff; font-size: 13px; font-weight: 700; margin: 0; }
    .zoi-msg .zoi-card-info span { color: #b4a5d8; font-size: 11px; }
    .zoi-msg .zoi-nutrition-pill {
        display: inline-flex; align-items: center; gap: 4px;
        background: #7c3aed22; color: #c4b5fd; font-size: 10px; font-weight: 700;
        padding: 3px 8px; border-radius: 8px; margin: 3px 3px 0 0;
    }

    .zoi-typing { display: flex; gap: 4px; padding: 12px 16px; align-self: flex-start; }
    .zoi-typing span {
        width: 8px; height: 8px; background: #3c1e6e; border-radius: 50%;
        animation: zoi-typing-dot 1.2s infinite ease-in-out;
    }
    .zoi-typing span:nth-child(2) { animation-delay: 0.2s; }
    .zoi-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes zoi-typing-dot { 0%,100%{transform:translateY(0);background:#3c1e6e} 50%{transform:translateY(-6px);background:#00f0ff} }

    .zoi-quick-actions {
        padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 6px;
        border-top: 1px solid #3c1e6e22; flex-shrink: 0;
    }
    .zoi-quick-btn {
        background: #1a0b3688; border: 1px solid #3c1e6e; border-radius: 20px;
        color: #b4a5d8; font-size: 11px; font-weight: 600; padding: 6px 12px;
        cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .zoi-quick-btn:hover { background: #00f0ff22; border-color: #00f0ff; color: #00f0ff; }

    .zoi-chat-input {
        display: flex; gap: 8px; padding: 12px 16px;
        border-top: 1px solid #3c1e6e; background: #0a031488;
        backdrop-filter: blur(8px); flex-shrink: 0;
    }
    .zoi-chat-input input {
        flex: 1; background: #1a0b36; border: 1px solid #3c1e6e;
        border-radius: 12px; padding: 10px 14px; color: #fff;
        font-size: 13px; outline: none; font-family: inherit;
        transition: border-color 0.2s;
    }
    .zoi-chat-input input::placeholder { color: #6b5c8a; }
    .zoi-chat-input input:focus { border-color: #00f0ff; }
    .zoi-chat-input button {
        width: 40px; height: 40px; border-radius: 12px;
        background: linear-gradient(135deg, #00f0ff, #7c3aed);
        border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s;
    }
    .zoi-chat-input button:hover { transform: scale(1.05); }
    .zoi-chat-input button svg { width: 18px; height: 18px; fill: #0a0314; }
    /* Feedback buttons */
    .zoi-feedback { display: flex; gap: 6px; margin-top: 8px; }
    .zoi-feedback button {
        background: rgba(255,255,255,0.06); border: 1px solid #3c1e6e44; border-radius: 8px;
        padding: 4px 10px; font-size: 11px; cursor: pointer; color: #b4a5d8;
        transition: all 0.2s; display: flex; align-items: center; gap: 4px;
    }
    .zoi-feedback button:hover { background: #00f0ff22; border-color: #00f0ff; color: #00f0ff; }
    .zoi-feedback button.voted { background: #00f0ff33; border-color: #00f0ff; color: #00f0ff; pointer-events: none; }
    .zoi-confidence-badge {
        display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 8px;
        border-radius: 6px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .zoi-confidence-badge.high { background: #05966933; color: #34d399; border: 1px solid #05966944; }
    .zoi-confidence-badge.medium { background: #f59e0b33; color: #fbbf24; border: 1px solid #f59e0b44; }
    .zoi-confidence-badge.low { background: #ef444433; color: #f87171; border: 1px solid #ef444444; }
    `;

    // ─── HTML TEMPLATE ──────────────────────────────────────
    const FAB_HTML = `
    <div id="zoi-ai-label"><span class="label-icon">⚡</span><span class="label-text">AI Powered</span></div>
    <button id="zoi-ai-fab" aria-label="Chat with Zoi AI" title="Chat with Zoi AI">
        <img src="https://cdn-icons-png.flaticon.com/512/8649/8649605.png" alt="Zoi AI Logo" />
        <div class="zoi-fab-badge" id="zoi-fab-badge" style="display:none">1</div>
    </button>`;

    const PANEL_HTML = `
    <div id="zoi-ai-panel">
        <div class="zoi-chat-header">
            <div class="zoi-avatar">🤖</div>
            <div class="zoi-info">
                <h4>Zoi AI</h4>
                <p>Your Food Concierge</p>
            </div>
            <button class="zoi-chat-close" id="zoi-chat-close" title="Close">✕</button>
        </div>
        <div class="zoi-chat-body" id="zoi-chat-body"></div>
        <div class="zoi-quick-actions" id="zoi-quick-actions"></div>
        <div class="zoi-chat-input">
            <input type="text" id="zoi-chat-input" placeholder="Ask me anything about food..." autocomplete="off" />
            <button id="zoi-chat-send" title="Send">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
        </div>
    </div>`;

    // ─── KNOWLEDGE BASE ─────────────────────────────────────
    const MOOD_MAP = {
        happy: { tags: ['Desserts', 'Pizza', 'Beverages'], msg: "You're in a great mood! 🎉 How about treating yourself?" },
        sad: { tags: ['Desserts', 'Coffee', 'Beverages', 'Ice Cream'], msg: "Sending comfort food vibes 🤗 These always help:" },
        tired: { tags: ['Coffee', 'Beverages', 'Fast Food', 'Biryani'], msg: "Energy boost incoming! ⚡ Try these:" },
        hungry: { tags: ['Biryani', 'North Indian', 'Pizza', 'Fast Food'], msg: "Let's fix that hunger fast! 🍔" },
        healthy: { tags: ['Healthy', 'Salads', 'Juices'], msg: "Great choice! 🥗 Here's what's fresh and healthy:" },
        adventurous: { tags: ['Asian', 'Chinese', 'Thai', 'Mughlai'], msg: "Feeling bold! 🌶️ Let's explore new flavors:" },
        lazy: { tags: ['Fast Food', 'Pizza', 'American'], msg: "Easy mode on! 🛋️ Quick bites heading your way:" },
        celebratory: { tags: ['Asian', 'Mughlai', 'Italian'], msg: "Time to celebrate! 🎊 Go premium:" },
        stressed: { tags: ['Coffee', 'Desserts', 'Beverages'], msg: "Take a breather 🧘 These will help you unwind:" },
        romantic: { tags: ['Italian', 'Pasta', 'Asian', 'Desserts'], msg: "Date night! 💕 Here are some romantic picks:" }
    };

    const NAV_MAP = {
        home: 'index.html', orders: 'customer_orders history.html',
        tracking: 'customer order_tracking.html', profile: 'customer profile.html',
        cart: 'shopping_cart.html', restaurants: 'customer_restaurant_listing.html',
        offers: 'promotions & offers.html', help: 'customer support help.html',
        loyalty: 'customer gamification hub.html', referral: 'customer referral program.html',
        subscription: 'Customer subscription service.html', feedback: 'feedback.html'
    };

    const GREETINGS = [
        "Hey there! 👋 I'm Zoi, your AI food concierge. How can I help today?",
        "Hi! 🤖 Ready to assist you with food, orders, or anything ZoiEats. What do you need?",
        "Welcome back! ✨ I can answer questions, guide you, recommend food, or troubleshoot issues. Just ask!"
    ];

    // ─── CONVERSATION CONTEXT MEMORY ─────────────────────────
    const conversationContext = { history: [], lastDomain: null, lastTopic: null };
    function pushContext(role, text, domain) {
        conversationContext.history.push({ role, text: text.substring(0, 200), ts: Date.now() });
        if (conversationContext.history.length > 10) conversationContext.history.shift();
        if (domain) { conversationContext.lastDomain = domain; conversationContext.lastTopic = text.substring(0, 80); }
    }

    // ─── COMPREHENSIVE KNOWLEDGE BASE (RAG Store) ────────────
    const ZOI_KNOWLEDGE_BASE = [
        // ══════ DOMAIN: CUSTOMER OPERATIONS ══════
        { domain: 'customer', keywords: ['refund', 'money back', 'cancel order', 'return', 'cancellation'], answer: "⭐ **Cancellations & Refunds**\n\n**Step 1:** Orders can be canceled within 60 seconds via the Order Tracking page.\n**Step 2:** For quality issues, submit a Support Ticket on the Support page.\n**Step 3:** Refunds are processed to your original payment method or Zoi Wallet within 24 hours.\n\n📖 *Source: ZoiEats Refund Policy*", weight: 1.0, source: 'Refund Policy' },
        { domain: 'customer', keywords: ['zoipass', 'subscription', 'free delivery', 'pass', 'unlimited delivery', 'membership'], answer: "🎟️ **ZoiPass Subscription**\n\n• Unlimited free deliveries on all orders\n• 10% off every order\n• Priority customer support\n• Exclusive member-only flash deals\n\nSubscribe from the **Subscriptions** page.\n\n📖 *Source: ZoiPass Benefits*", weight: 1.0, source: 'ZoiPass' },
        { domain: 'customer', keywords: ['points', 'zippoints', 'gamification', 'rewards', 'loyalty', 'redeem points', 'earn points'], answer: "🏆 **ZipPoints & Rewards System**\n\n**Earn points by:**\n• Ordering food (+10 pts per order)\n• Submitting feedback (+50 pts)\n• Referring friends (+200 pts)\n• Writing reviews (+50 pts)\n\n**Redeem** points for discounts at checkout. Check the **Gamification Hub** for your tier!\n\n📖 *Source: ZipPoints Program*", weight: 1.0, source: 'Gamification' },
        { domain: 'customer', keywords: ['track', 'where is my order', 'order status', 'delivery boy', 'tracking', 'rider location', 'eta'], answer: "📍 **Real-Time Order Tracking**\n\n**Step 1:** Go to the **Order Tracking** page\n**Step 2:** Select your active order\n**Step 3:** View the rider's live GPS location on the map\n\nYou'll also receive push notifications for each status change.\n\n📖 *Source: Order Tracking Help*", weight: 1.0, source: 'Order Tracking' },
        { domain: 'customer', keywords: ['payment', 'upi', 'cash', 'cod', 'card', 'payment method', 'pay', 'net banking', 'wallet'], answer: "💳 **Payment Methods**\n\n• **UPI** — Google Pay, PhonePe, Paytm\n• **Cards** — Visa, Mastercard, RuPay\n• **Net Banking** — All major banks\n• **Zoi Wallet** — Preloaded balance\n• **COD** — Available for orders under ₹1000 in select areas\n\nAll payments are secured with 256-bit encryption.\n\n📖 *Source: Payment Security*", weight: 1.0, source: 'Payments' },
        { domain: 'customer', keywords: ['feedback', 'complain', 'suggestion', 'feature request', 'bug report', 'issue'], answer: "💬 **Feedback & Suggestions**\n\n**Step 1:** Go to the **Feedback** page\n**Step 2:** Select category (Bug, Feature Request, General)\n**Step 3:** Submit your message\n\nYou earn **50 ZipPoints** for approved feedback! Our team reviews every submission.\n\n📖 *Source: Feedback Portal*", weight: 1.0, source: 'Feedback' },
        { domain: 'customer', keywords: ['address', 'change address', 'add address', 'delivery address', 'location', 'saved address'], answer: "📍 **Manage Addresses**\n\nGo to **Profile → Addresses** to add, edit, or remove delivery addresses. You can set a default address for faster checkout.\n\n📖 *Source: Address Management*", weight: 0.9, source: 'Profile' },
        { domain: 'customer', keywords: ['coupon', 'promo code', 'discount', 'offer', 'deal'], answer: "🎉 **Coupons & Offers**\n\nCheck the **Promotions & Offers** page for active deals. Apply coupon codes at checkout in the cart page. Some coupons are auto-applied for ZoiPass members!\n\n📖 *Source: Promotions*", weight: 0.9, source: 'Promotions' },
        { domain: 'customer', keywords: ['refer', 'referral', 'invite friend', 'referral code', 'share'], answer: "🤝 **Referral Program**\n\nShare your unique referral code with friends. When they place their first order, you BOTH get **₹200 off**! Find your code on the **Referral Program** page.\n\n📖 *Source: Referral Program*", weight: 0.9, source: 'Referrals' },
        { domain: 'customer', keywords: ['account', 'delete account', 'deactivate', 'privacy', 'data'], answer: "🔒 **Account & Privacy**\n\nTo manage your account data, go to **Profile → Settings**. For account deletion requests, contact support and we'll process it within 72 hours per our data retention policy.\n\n📖 *Source: Privacy Policy*", weight: 0.8, source: 'Privacy' },
        // ══════ DOMAIN: FOOD & NUTRITION ══════
        { domain: 'food', keywords: ['calorie', 'calories', 'how many calories', 'kcal', 'caloric'], answer: "🔥 **Calorie Information**\n\nI can estimate calories for common dishes:\n• Biryani: ~520 kcal\n• Burger: ~550 kcal\n• Pizza (slice): ~680 kcal\n• Salad: ~150 kcal\n• Thali: ~620 kcal\n\nAsk me about a specific dish for details!\n\n📖 *Source: Zoi Nutrition Database*", weight: 1.0, source: 'Nutrition DB' },
        { domain: 'food', keywords: ['protein', 'high protein', 'protein rich', 'muscle', 'gym', 'workout'], answer: "💪 **High-Protein Options**\n\nTop protein-rich picks:\n• Chicken Tikka: 26g protein\n• Paneer Tikka: 22g protein\n• Egg Biryani: 28g protein\n• Grilled Fish: 30g protein\n\nFilter by 'High Protein' on any restaurant menu!\n\n📖 *Source: Zoi Nutrition Database*", weight: 1.0, source: 'Nutrition DB' },
        { domain: 'food', keywords: ['diet', 'weight loss', 'low calorie', 'low fat', 'keto', 'intermittent fasting'], answer: "🥬 **Diet-Friendly Options**\n\n**Low Calorie (<400 kcal):** Salads, Grilled items, Soups\n**Keto:** Paneer/Chicken without rice, Tandoori items\n**High Fiber:** Dal, Rajma, whole grain wraps\n\nUse the 'Healthy' filter on restaurant listings!\n\n📖 *Source: Zoi Nutrition Guide*", weight: 1.0, source: 'Nutrition Guide' },
        { domain: 'food', keywords: ['vegan', 'vegetarian', 'veg', 'plant based', 'no meat', 'pure veg'], answer: "🌱 **Vegan & Vegetarian**\n\nFilter restaurants by **#PureVeg** on the homepage. Many restaurants clearly mark veg items with a green dot (🟢). Tell me your area and I'll find the best veg options nearby!\n\n📖 *Source: Dietary Filters*", weight: 1.0, source: 'Dietary' },
        { domain: 'food', keywords: ['allergy', 'allergen', 'gluten', 'lactose', 'nut allergy', 'intolerance'], answer: "⚠️ **Allergen Information**\n\nMost restaurants list common allergens (nuts, gluten, dairy, soy) on their menus. If you have a severe allergy, we recommend:\n1. Check the item description on the menu\n2. Add a note in the 'Special Instructions' field\n3. Contact the restaurant directly before ordering\n\n📖 *Source: Food Safety Guidelines*", weight: 1.0, source: 'Food Safety' },
        { domain: 'food', keywords: ['ingredient', 'what is in', 'made of', 'contains', 'recipe'], answer: "🧪 **Ingredient Information**\n\nDetailed ingredients are listed on each menu item page. For specific preparation questions, you can use the restaurant chat feature to ask the kitchen directly.\n\n📖 *Source: Menu Information*", weight: 0.8, source: 'Menu' },
        // ══════ DOMAIN: ADMIN OPERATIONS ══════
        { domain: 'admin', keywords: ['ban user', 'block user', 'suspend', 'blacklist', 'deactivate user'], answer: "🛡️ **Admin: User Management**\n\n**Step 1:** Go to **Admin Zone Management** or **Dispute Resolution**\n**Step 2:** Search for the user's profile\n**Step 3:** Click 'Suspend Account'\n**Step 4:** Provide a reason (required for audit logs)\n\nSuspended users cannot login or place orders.\n\n📖 *Source: Admin Operations Manual*", weight: 1.0, source: 'Admin Manual' },
        { domain: 'admin', keywords: ['system health', 'server down', 'cpu', 'memory', 'logs', 'api latency', 'uptime'], answer: "💻 **Admin: System Health**\n\nReal-time metrics on the **Admin System Health** dashboard:\n• CPU & Memory usage\n• API response latency\n• Active connections\n• Error rate percentage\n\nCritical alerts flash red. Set up webhook notifications for downtime alerts.\n\n📖 *Source: System Health Dashboard*", weight: 1.0, source: 'System Health' },
        { domain: 'admin', keywords: ['approve restaurant', 'onboard partner', 'verify kyc', 'fssai', 'gst verification'], answer: "📋 **Admin: Partner Onboarding**\n\n**Step 1:** New applications appear in **Admin Partner Onboarding** queue\n**Step 2:** Review FSSAI license and GST registration\n**Step 3:** Verify bank details for payouts\n**Step 4:** Click 'Approve' to go live\n\nAverage onboarding time: 24-48 hours.\n\n📖 *Source: Onboarding SOP*", weight: 1.0, source: 'Onboarding' },
        { domain: 'admin', keywords: ['dispute', 'ticket', 'support dashboard', 'escalation', 'sla'], answer: "⚖️ **Admin: Dispute Resolution**\n\nAll tickets route to **Admin Dispute Resolution** console.\n• SLA: First response within 2 hours\n• Priority levels: P1 (Critical) → P4 (Low)\n• Auto-escalation after SLA breach\n\n📖 *Source: Support SLA Policy*", weight: 1.0, source: 'SLA Policy' },
        { domain: 'admin', keywords: ['zone', 'geofence', 'delivery area', 'surge', 'surge pricing', 'delivery radius'], answer: "🗺️ **Admin: Zones & Surge**\n\nUse **Admin Zone Management** to:\n• Define delivery radiuses per zone\n• Set surge pricing multipliers\n• Enable/disable zones during events\n• View heat maps of demand\n\n📖 *Source: Zone Management*", weight: 1.0, source: 'Zone Mgmt' },
        { domain: 'admin', keywords: ['content moderation', 'review moderation', 'inappropriate', 'flagged'], answer: "🚨 **Admin: Content Moderation**\n\nFlagged items appear in **Admin Content Moderation**:\n• User reviews with profanity\n• Suspicious menu images\n• Reported chat messages\n\nActions: Approve, Edit, or Remove with audit trail.\n\n📖 *Source: Moderation Policy*", weight: 1.0, source: 'Moderation' },
        // ══════ DOMAIN: PARTNER / RESTAURANT ══════
        { domain: 'partner', keywords: ['add menu', 'edit item', 'price change', 'out of stock', 'menu management', 'update menu'], answer: "🍳 **Partner: Menu Management**\n\n**Step 1:** Open **Restaurant Menu Manager**\n**Step 2:** Click '+Add Item' or edit existing\n**Step 3:** Set name, price, description, image\n**Step 4:** Toggle availability status\n\nChanges reflect on the customer app immediately.\n\n📖 *Source: Partner Dashboard Guide*", weight: 1.0, source: 'Partner Guide' },
        { domain: 'partner', keywords: ['payout', 'bank settlement', 'earnings', 'commission', 'revenue', 'income'], answer: "💰 **Partner: Financials & Payouts**\n\n• Settlements every **Tuesday and Friday**\n• Standard commission: **15%**\n• View detailed statements in **Restaurant Financials**\n• GST invoices auto-generated monthly\n\nBank details can be updated in Restaurant Settings.\n\n📖 *Source: Partner Financial Policy*", weight: 1.0, source: 'Financial Policy' },
        { domain: 'partner', keywords: ['staff', 'add manager', 'waiter', 'sub account', 'staff login', 'cashier'], answer: "👥 **Partner: Staff Management**\n\n**Step 1:** Go to **Restaurant Staff Management**\n**Step 2:** Click 'Add Staff Member'\n**Step 3:** Assign role (Manager, Cashier, Kitchen)\n**Step 4:** Set permissions (e.g., hide financials)\n\nEach staff gets their own login credentials.\n\n📖 *Source: Staff Management Guide*", weight: 1.0, source: 'Staff Guide' },
        { domain: 'partner', keywords: ['restaurant analytics', 'dashboard', 'performance', 'sales report', 'order volume'], answer: "📊 **Partner: Analytics & Reports**\n\nYour **Restaurant Dashboard** shows:\n• Daily/weekly/monthly order volume\n• Revenue trends and top-selling items\n• Customer ratings and review analysis\n• Peak hours and demand patterns\n\n📖 *Source: Analytics Dashboard*", weight: 0.9, source: 'Analytics' },
        { domain: 'partner', keywords: ['restaurant registration', 'register restaurant', 'add restaurant', 'partner signup', 'join platform'], answer: "🏪 **Become a Partner**\n\n**Step 1:** Visit **Restaurant Pricing Plans**\n**Step 2:** Choose a plan (Basic/Pro/Enterprise)\n**Step 3:** Submit FSSAI license, GST certificate, bank details\n**Step 4:** Our team verifies within 24-48 hours\n\n📖 *Source: Partner Onboarding*", weight: 1.0, source: 'Partner Onboarding' },
        // ══════ DOMAIN: RIDER / DELIVERY ══════
        { domain: 'rider', keywords: ['rider payment', 'delivery earning', 'rider payout', 'when paid', 'rider salary', 'incentive'], answer: "🏍️ **Rider: Payments & Incentives**\n\n• Base delivery fee: ₹30-80 per order (distance-based)\n• Surge bonus during peak hours\n• Weekly payouts every Monday\n• Incentive bonuses for completing 20+ deliveries/day\n\nView earnings in **Rider Dashboard → Financials**\n\n📖 *Source: Rider Payment Policy*", weight: 1.0, source: 'Rider Payments' },
        { domain: 'rider', keywords: ['rider signup', 'become rider', 'delivery partner', 'rider registration', 'ride with us', 'join rider'], answer: "🚴 **Become a Delivery Partner**\n\n**Step 1:** Visit **Delivery Partner Application**\n**Step 2:** Upload DL, vehicle RC, Aadhaar\n**Step 3:** Complete background verification\n**Step 4:** Attend 30-min online training\n\nStart earning from Day 1 after approval!\n\n📖 *Source: Rider Application*", weight: 1.0, source: 'Rider Application' },
        { domain: 'rider', keywords: ['route', 'navigation', 'delivery route', 'optimized route', 'gps', 'map'], answer: "🗺️ **Rider: Smart Routing**\n\nZoi's AI automatically optimizes your delivery route for:\n• Shortest distance\n• Least traffic\n• Multi-order batching\n\nFollow the in-app GPS navigation for turn-by-turn directions.\n\n📖 *Source: Rider Operations*", weight: 0.9, source: 'Rider Ops' },
        { domain: 'rider', keywords: ['rider performance', 'rating', 'rider score', 'delivery time', 'acceptance rate'], answer: "⭐ **Rider: Performance Metrics**\n\nYour performance is tracked by:\n• **Acceptance Rate** — Accept 80%+ for bonus eligibility\n• **Average Delivery Time** — Under 30 min is excellent\n• **Customer Rating** — Maintain 4.5+\n• **Completion Rate** — Don't cancel accepted orders\n\n📖 *Source: Rider Performance Guide*", weight: 0.9, source: 'Rider Performance' },
        // ══════ DOMAIN: POS & IT SUPPORT ══════
        { domain: 'pos', keywords: ['pos integration', 'offline orders', 'dine in', 'pos sync', 'pos setup'], answer: "🔌 **Zoi POS Integration**\n\nZoi POS syncs offline dine-in orders with online delivery:\n\n**Step 1:** Enable POS in **Restaurant Settings**\n**Step 2:** Add tables/QR codes\n**Step 3:** Train staff on the POS interface\n\nPOS works offline and syncs when internet returns.\n\n📖 *Source: POS Setup Guide*", weight: 1.0, source: 'POS Guide' },
        { domain: 'pos', keywords: ['register hosteler', 'add student', 'upload document', 'hostel registration'], answer: "🎓 **POS: Hosteler Onboarding**\n\n**Step 1:** Go to **POS Registration**\n**Step 2:** Capture hosteler's photo\n**Step 3:** Upload ID proof (College ID / Aadhaar)\n**Step 4:** Assign room and meal plan\n\nProfile activates instantly.\n\n📖 *Source: Hostel POS Manual*", weight: 1.0, source: 'Hostel POS' },
        { domain: 'pos', keywords: ['split bill', 'divide payment', 'share cost', 'bill split'], answer: "🧾 **POS: Bill Splitting**\n\n**Step 1:** Open the table's bill\n**Step 2:** Click 'Split Bill'\n**Step 3:** Choose: split evenly OR assign items per person\n**Step 4:** Process each payment separately\n\n📖 *Source: POS Billing Guide*", weight: 1.0, source: 'POS Billing' },
        { domain: 'pos', keywords: ['inventory', 'stock', 'ingredients', 'raw material', 'stock management'], answer: "📦 **POS: Inventory Management**\n\nThe POS Inventory module:\n• Auto-deducts stock when dishes are sold\n• Alerts when items are low\n• Supports bulk stock entry\n• Generates waste reports\n\n📖 *Source: Inventory Module*", weight: 1.0, source: 'Inventory' },
        { domain: 'pos', keywords: ['pos not working', 'pos error', 'pos crash', 'system error', 'technical issue', 'bug', 'app crash'], answer: "🔧 **IT: Troubleshooting**\n\n**Step 1:** Clear browser cache (Ctrl+Shift+Delete)\n**Step 2:** Check internet connectivity\n**Step 3:** Try a different browser (Chrome recommended)\n**Step 4:** If issue persists, submit a Support Ticket with screenshots\n\nFor urgent issues, call our IT hotline.\n\n📖 *Source: IT Support FAQ*", weight: 1.0, source: 'IT Support' },
        { domain: 'pos', keywords: ['printer', 'receipt printer', 'print not working', 'thermal printer'], answer: "🖨️ **IT: Printer Setup**\n\n**Step 1:** Ensure printer is connected via USB or WiFi\n**Step 2:** Go to **POS Settings → Printer Configuration**\n**Step 3:** Select your printer model\n**Step 4:** Print a test receipt\n\nSupported: Epson TM series, Star TSP series\n\n📖 *Source: Hardware Setup*", weight: 0.9, source: 'Hardware' },
        // ══════ DOMAIN: GENERAL PLATFORM ══════
        { domain: 'general', keywords: ['about', 'what is zoieats', 'zipzapzoi', 'company', 'who are you'], answer: "⚡ **About ZipZapZoi Eats**\n\nZipZapZoi Eats is an AI-powered food delivery platform bringing authentic Indian flavors to your doorstep. We connect customers with local restaurants through intelligent recommendations, real-time tracking, and a gamified loyalty experience.\n\n📖 *Source: About Us*", weight: 0.8, source: 'About' },
        { domain: 'general', keywords: ['contact', 'phone number', 'email', 'reach us', 'customer care'], answer: "📞 **Contact Us**\n\n• Email: reachus@zipzapzoi.com\n• Support: Available 24/7 via Zoi AI Chat\n• Ticket: Submit via **Support Help** page\n• Response time: Within 2 hours\n\n📖 *Source: Contact Information*", weight: 0.8, source: 'Contact' },
        { domain: 'general', keywords: ['hours', 'operating hours', 'delivery time', 'available', 'open'], answer: "🕐 **Operating Hours**\n\nZoiEats operates **24/7** in most metro areas. Restaurant availability varies — check individual restaurant pages for their operating hours. Late-night delivery (11PM-6AM) may have limited options.\n\n📖 *Source: Service Hours*", weight: 0.8, source: 'Service Info' },
    ];

    // ─── RAG SCORING ENGINE ──────────────────────────────────
    const CONFIDENCE = { HIGH: 0.8, MEDIUM: 0.5, LOW: 0.3 };
    const CONFIDENCE_LABELS = { HIGH: '🟢 High Confidence', MEDIUM: '🟡 Moderate Confidence', LOW: '🔴 Low Confidence' };

    function getPageDomain() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('admin')) return 'admin';
        if (path.includes('partner') || path.includes('restaurant_')) return 'partner';
        if (path.includes('pos') || path.includes('hostel')) return 'pos';
        if (path.includes('rider')) return 'rider';
        return 'customer';
    }

    function scoreKnowledgeMatch(inputTokens, entry, contextDomain) {
        let score = 0;
        const feedbackWeights = getAIFeedbackWeights();
        entry.keywords.forEach(keyword => {
            const kwTokens = keyword.toLowerCase().split(' ');
            if (kwTokens.length > 1 && kwTokens.every(k => inputTokens.includes(k))) score += 5;
            else if (kwTokens.some(k => inputTokens.some(t => t === k))) score += 2;
            else if (kwTokens.some(k => inputTokens.some(t => t.includes(k) || k.includes(t)))) score += 1;
        });
        // Domain boost: if user is on a matching page
        if (entry.domain === contextDomain) score *= 1.5;
        // Context boost: if last conversation was about the same domain
        if (conversationContext.lastDomain === entry.domain) score *= 1.2;
        // Apply learned feedback weight
        const fbKey = entry.source || entry.keywords[0];
        if (feedbackWeights[fbKey]) score *= feedbackWeights[fbKey];
        // Apply entry's base weight
        score *= (entry.weight || 1.0);
        return score;
    }

    function retrieveKnowledge(input) {
        const tokens = input.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(t => t.length > 1);
        const contextDomain = getPageDomain();
        let bestEntry = null, bestScore = 0;
        for (const entry of ZOI_KNOWLEDGE_BASE) {
            const score = scoreKnowledgeMatch(tokens, entry, contextDomain);
            if (score > bestScore) { bestScore = score; bestEntry = entry; }
        }
        // Normalize score to 0-1 confidence
        const maxPossibleScore = 15; // approximate max for a perfect multi-keyword match
        const confidence = Math.min(bestScore / maxPossibleScore, 1.0);
        let level = 'LOW';
        if (confidence >= CONFIDENCE.HIGH) level = 'HIGH';
        else if (confidence >= CONFIDENCE.MEDIUM) level = 'MEDIUM';
        return { entry: bestEntry, score: bestScore, confidence, level };
    }

    // ─── CONTINUOUS LEARNING: FEEDBACK STORE ─────────────────
    function getAIFeedbackWeights() {
        try { return JSON.parse(localStorage.getItem('zoiAIFeedbackWeights')) || {}; } catch(e) { return {}; }
    }
    function recordFeedback(source, isPositive) {
        const weights = getAIFeedbackWeights();
        const current = weights[source] || 1.0;
        weights[source] = isPositive ? Math.min(current * 1.1, 2.0) : Math.max(current * 0.85, 0.3);
        localStorage.setItem('zoiAIFeedbackWeights', JSON.stringify(weights));
        // Also log the raw feedback event
        const log = JSON.parse(localStorage.getItem('zoiAIFeedbackLog') || '[]');
        log.push({ source, positive: isPositive, ts: Date.now() });
        if (log.length > 500) log.splice(0, log.length - 500);
        localStorage.setItem('zoiAIFeedbackLog', JSON.stringify(log));
    }
    // Expose globally for inline onclick
    window._zoiRecordFeedback = recordFeedback;

    // ─── DATA ACCESS ────────────────────────────────────────
    function getRestaurants() {
        try {
            if (typeof ZoiRestaurants !== 'undefined') return ZoiRestaurants.getAll();
            if (typeof DB_RESTAURANTS !== 'undefined') return DB_RESTAURANTS;
        } catch (e) { }
        return [];
    }

    function getMenus() {
        try { return typeof DB_MENUS !== 'undefined' ? DB_MENUS : {}; } catch (e) { return {}; }
    }

    function getOrderHistory() {
        try {
            return JSON.parse(localStorage.getItem('zoiOrderHistory')) || [];
        } catch (e) { return []; }
    }

    function getUserProfile() {
        // PRIORITY ORDER: Real login session → Customer session → Legacy user → Profile → Fallback
        try {
            if (typeof ZoiCustomer !== 'undefined' && ZoiCustomer.getSession && ZoiCustomer.getSession()) {
                return ZoiCustomer.getSession();
            }
            const sess = JSON.parse(localStorage.getItem('zoiCustomerSession'));
            if (sess && sess.name) return sess;
            const legacy = JSON.parse(localStorage.getItem('zoiUser'));
            if (legacy && legacy.name && legacy.name !== 'New User') return legacy;
            const profile = JSON.parse(localStorage.getItem('zoiUserProfile'));
            if (profile && profile.name) return profile;
        } catch (e) { }
        return { name: '' };
    }

    function getHealthGoals() {
        try {
            return JSON.parse(localStorage.getItem('zoiHealthGoals')) || null;
        } catch (e) { return null; }
    }

    // ─── NUTRITION LOOKUP ───────────────────────────────────
    const NUTRITION_DB = {
        biryani: { cal: 520, protein: 28, carbs: 62, fat: 18 },
        chicken: { cal: 450, protein: 35, carbs: 15, fat: 22 },
        paneer: { cal: 380, protein: 22, carbs: 18, fat: 24 },
        burger: { cal: 550, protein: 25, carbs: 45, fat: 30 },
        pizza: { cal: 680, protein: 22, carbs: 72, fat: 32 },
        naan: { cal: 260, protein: 8, carbs: 45, fat: 5 },
        salad: { cal: 150, protein: 6, carbs: 18, fat: 7 },
        coffee: { cal: 120, protein: 4, carbs: 16, fat: 5 },
        ramen: { cal: 480, protein: 20, carbs: 58, fat: 16 },
        sushi: { cal: 320, protein: 18, carbs: 42, fat: 8 },
        rice: { cal: 340, protein: 6, carbs: 72, fat: 2 },
        tikka: { cal: 350, protein: 26, carbs: 12, fat: 20 },
        fries: { cal: 380, protein: 4, carbs: 48, fat: 20 },
        thali: { cal: 620, protein: 18, carbs: 80, fat: 20 },
        pasta: { cal: 520, protein: 16, carbs: 65, fat: 18 },
        wrap: { cal: 420, protein: 22, carbs: 40, fat: 16 },
        sandwich: { cal: 380, protein: 18, carbs: 35, fat: 16 },
        juice: { cal: 140, protein: 2, carbs: 32, fat: 0 },
        smoothie: { cal: 220, protein: 8, carbs: 38, fat: 4 },
        dessert: { cal: 350, protein: 4, carbs: 55, fat: 14 },
        cake: { cal: 400, protein: 5, carbs: 52, fat: 20 },
        icecream: { cal: 280, protein: 4, carbs: 36, fat: 14 },
        'default': { cal: 400, protein: 15, carbs: 45, fat: 16 }
    };

    function estimateNutrition(itemName) {
        const lower = itemName.toLowerCase();
        for (const key of Object.keys(NUTRITION_DB)) {
            if (key !== 'default' && lower.includes(key)) return { ...NUTRITION_DB[key] };
        }
        return { ...NUTRITION_DB['default'] };
    }

    // ─── INTENT DETECTION (Multi-Layer) ────────────────────
    function detectIntent(input) {
        const lower = input.toLowerCase().trim();
        const tokens = lower.replace(/[^\w\s]/g, '').split(/\s+/);

        // Layer 0: Greeting — fast path
        if (['hi', 'hello', 'hey', 'hola', 'sup', 'yo', 'namaste', 'hii', 'hiii', 'good morning', 'good evening', 'good afternoon'].some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','))) {
            return { intent: 'greeting' };
        }

        // Layer 0: Help — fast path
        if (lower === 'help' || lower === 'what can you do' || lower.includes('capabilities') || lower === 'features' || lower === 'menu') {
            return { intent: 'help' };
        }

        // Layer 1: Navigation (explicit "go to" / "open" commands)
        for (const [key, url] of Object.entries(NAV_MAP)) {
            if (lower.includes(key) && (lower.includes('go to') || lower.includes('take me') || lower.includes('show me') || lower.includes('open') || lower.includes('navigate'))) {
                return { intent: 'navigate', page: key, url };
            }
        }

        // Layer 2: Action intents (reorder, history)
        if (lower.includes('reorder') || lower.includes('order again') || lower.includes('my usual') || lower.includes('same as last') || lower.includes('repeat order')) {
            return { intent: 'reorder' };
        }
        if (lower.includes('order history') || lower.includes('past order') || lower.includes('last order') || lower.includes('previous order') || lower.includes('what did i order')) {
            return { intent: 'order_history' };
        }

        // Layer 3: Mood-based
        for (const mood of Object.keys(MOOD_MAP)) {
            if (lower.includes(mood) || lower.includes(`i'm ${mood}`) || lower.includes(`feeling ${mood}`) || lower.includes(`i am ${mood}`)) {
                return { intent: 'mood', mood };
            }
        }

        // Layer 4: RAG Knowledge Base Retrieval (replaces old FAQ)
        const ragResult = retrieveKnowledge(input);
        if (ragResult.level === 'HIGH') {
            pushContext('bot', ragResult.entry.answer, ragResult.entry.domain);
            return { intent: 'knowledge_answer', text: ragResult.entry.answer, confidence: ragResult.level, source: ragResult.entry.source, domain: ragResult.entry.domain };
        }

        // Layer 5: Nutrition / health queries (with menu data)
        if (lower.includes('calorie') || lower.includes('nutrition') || lower.includes('protein') || lower.includes('healthy') || lower.includes('diet') || lower.includes('keto') || lower.includes('low cal') || lower.includes('low fat') || lower.includes('high protein') || lower.includes('vegan') || lower.includes('fitness')) {
            // If RAG had a MEDIUM match for nutrition, use it
            if (ragResult.level === 'MEDIUM' && ragResult.entry && ragResult.entry.domain === 'food') {
                pushContext('bot', ragResult.entry.answer, 'food');
                return { intent: 'knowledge_answer', text: ragResult.entry.answer, confidence: ragResult.level, source: ragResult.entry.source, domain: 'food' };
            }
            return { intent: 'nutrition', query: lower };
        }

        // Layer 6: Budget search
        const budgetMatch = lower.match(/under\s*₹?\s*(\d+)|below\s*₹?\s*(\d+)|within\s*₹?\s*(\d+)|less than\s*₹?\s*(\d+)|budget\s*₹?\s*(\d+)|cheap/i);
        if (budgetMatch) {
            const budget = parseInt(budgetMatch[1] || budgetMatch[2] || budgetMatch[3] || budgetMatch[4] || budgetMatch[5] || 300);
            return { intent: 'budget', budget };
        }

        // Layer 7: Food type search
        const foodTypes = ['biryani', 'pizza', 'burger', 'sushi', 'ramen', 'coffee', 'chai', 'salad', 'paneer', 'chicken', 'veg', 'non-veg', 'chinese', 'italian', 'north indian', 'south indian', 'mexican', 'thai', 'dessert', 'cake', 'ice cream', 'fast food', 'noodles', 'pasta', 'sandwich', 'wrap', 'juice', 'smoothie'];
        for (const food of foodTypes) {
            if (lower.includes(food)) return { intent: 'food_search', food };
        }

        // Layer 8: Spicy / Popular
        if (lower.includes('spicy') || lower.includes('hot food') || lower.includes('fiery')) {
            return { intent: 'preference', pref: 'spicy' };
        }
        if (lower.includes('popular') || lower.includes('trending') || lower.includes('best') || lower.includes('top rated') || lower.includes('highest rated') || lower.includes('recommended')) {
            return { intent: 'popular' };
        }

        // Layer 9: If RAG had a MEDIUM match, use it with a qualifier
        if (ragResult.level === 'MEDIUM' && ragResult.entry) {
            pushContext('bot', ragResult.entry.answer, ragResult.entry.domain);
            return { intent: 'knowledge_answer', text: ragResult.entry.answer, confidence: ragResult.level, source: ragResult.entry.source, domain: ragResult.entry.domain };
        }

        // Layer 10: Fallback — try restaurant/menu match or escalate
        return { intent: 'general', query: lower, ragResult };
    }

    // ─── RESPONSE GENERATOR ─────────────────────────────────
    function generateResponse(intent) {
        const restaurants = getRestaurants();
        const menus = getMenus();

        switch (intent.intent) {
            case 'faq_answer':
            case 'knowledge_answer': {
                let prefix = '';
                let badge = '';
                const src = intent.source || 'Knowledge Base';
                if (intent.confidence === 'MEDIUM') {
                    prefix = '🟡 *Based on my understanding:*\n\n';
                    badge = 'medium';
                } else if (intent.confidence === 'LOW') {
                    prefix = '🔴 *I\'m not very confident, but here\'s what I found:*\n\n';
                    badge = 'low';
                } else {
                    badge = 'high';
                }
                return { text: prefix + intent.text, feedbackSource: src, confidenceBadge: badge };
            }

            case 'greeting':
                return { text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] };

            case 'help':
                return {
                    text: "Here's everything I can help you with! 🚀\n\n**🍕 Food** — Search, nutrition, diet advice\n**📦 Orders** — Track, reorder, history\n**💳 Payments** — Methods, refunds, wallet\n**🎯 Platform** — ZoiPass, points, referrals\n**🏪 Partner** — Menu, payouts, staff\n**🏍️ Rider** — Earnings, routes, performance\n**🔧 IT/POS** — Troubleshooting, setup",
                    tags: [
                        { label: '🍕 Find food', query: 'Show me pizza' },
                        { label: '💰 Budget meals', query: 'Under ₹200' },
                        { label: '😴 Mood picks', query: "I'm tired" },
                        { label: '📋 Orders', query: 'My past orders' },
                        { label: '🔁 Reorder', query: 'Reorder my usual' },
                        { label: '🥗 Nutrition', query: 'High protein meals' },
                        { label: '📍 Navigate', query: 'Go to my orders' },
                        { label: '⭐ Top rated', query: 'Best restaurants' },
                        { label: '💳 Refunds', query: 'How do I get a refund?' },
                        { label: '🏪 Partner', query: 'How to add menu items' }
                    ]
                };

            case 'navigate':
                return {
                    text: `Taking you to **${intent.page.charAt(0).toUpperCase() + intent.page.slice(1)}** 🚀`,
                    action: () => { window.location.href = intent.url; }
                };

            case 'mood': {
                const moodData = MOOD_MAP[intent.mood];
                const matched = restaurants.filter(r => r.tags.some(t => moodData.tags.some(mt => t.toLowerCase().includes(mt.toLowerCase()))));
                return {
                    text: moodData.msg,
                    cards: matched.slice(0, 3).map(r => ({
                        name: r.name, sub: `${r.rating}⭐ • ${r.time} • ${r.cost}`,
                        img: r.image, url: `restaurant_menu.html?id=${r.id}`
                    }))
                };
            }

            case 'budget': {
                const allItems = [];
                for (const [restId, items] of Object.entries(menus)) {
                    const rest = restaurants.find(r => r.id === restId);
                    items.forEach(item => {
                        if (item.price <= intent.budget) {
                            allItems.push({ ...item, restName: rest ? rest.name : 'Restaurant', restId });
                        }
                    });
                }
                if (allItems.length === 0) {
                    return { text: `Hmm, nothing under ₹${intent.budget} in our catalog right now. Try a slightly higher budget? 💡` };
                }
                allItems.sort((a, b) => b.price - a.price);
                return {
                    text: `Found **${allItems.length} items** under ₹${intent.budget}! 💰 Here are the best:`,
                    cards: allItems.slice(0, 4).map(item => ({
                        name: `${item.name} — ₹${item.price}`,
                        sub: `${item.restName} • ${item.desc.substring(0, 50)}`,
                        img: item.img, url: `restaurant_menu.html?id=${item.restId}`
                    }))
                };
            }

            case 'food_search': {
                const matched = restaurants.filter(r =>
                    r.tags.some(t => t.toLowerCase().includes(intent.food)) ||
                    r.name.toLowerCase().includes(intent.food)
                );
                if (matched.length === 0) {
                    return { text: `I couldn't find restaurants with "${intent.food}" right now. Try browsing all restaurants? 🔍`, tags: [{ label: '🍽️ Browse All', query: 'Go to restaurants' }] };
                }
                return {
                    text: `Great choice! Found **${matched.length} spots** for ${intent.food} 🎯`,
                    cards: matched.slice(0, 3).map(r => ({
                        name: r.name, sub: `${r.rating}⭐ • ${r.time} • ${r.tags.join(', ')}`,
                        img: r.image, url: `restaurant_menu.html?id=${r.id}`
                    }))
                };
            }

            case 'preference': {
                const allSpicy = [];
                for (const [restId, items] of Object.entries(menus)) {
                    const rest = restaurants.find(r => r.id === restId);
                    items.forEach(item => {
                        if (item.spicy) allSpicy.push({ ...item, restName: rest ? rest.name : 'Restaurant', restId });
                    });
                }
                return {
                    text: `🌶️ Fire it up! Here are the spiciest picks:`,
                    cards: allSpicy.slice(0, 4).map(item => ({
                        name: `${item.name} 🔥`, sub: `₹${item.price} • ${item.restName}`,
                        img: item.img, url: `restaurant_menu.html?id=${item.restId}`
                    }))
                };
            }

            case 'popular': {
                const sorted = [...restaurants].sort((a, b) => b.rating - a.rating);
                return {
                    text: "Here are the highest rated restaurants right now! ⭐",
                    cards: sorted.slice(0, 3).map(r => ({
                        name: `${r.name} — ${r.rating}⭐`, sub: `${r.time} • ${r.tags.join(', ')}`,
                        img: r.image, url: `restaurant_menu.html?id=${r.id}`
                    }))
                };
            }

            case 'nutrition': {
                const healthGoals = getHealthGoals();
                let text = "🥗 **Nutrition-focused picks:**\n\n";

                if (intent.query.includes('high protein') || intent.query.includes('protein')) {
                    const proteinItems = [];
                    for (const [restId, items] of Object.entries(menus)) {
                        const rest = restaurants.find(r => r.id === restId);
                        items.forEach(item => {
                            if (item.protein || item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('paneer')) {
                                const nut = estimateNutrition(item.name);
                                proteinItems.push({ ...item, nutrition: nut, restName: rest ? rest.name : 'Restaurant', restId });
                            }
                        });
                    }
                    proteinItems.sort((a, b) => b.nutrition.protein - a.nutrition.protein);
                    text = "💪 **High-protein picks** for your fitness goals:";
                    return {
                        text,
                        cards: proteinItems.slice(0, 4).map(item => ({
                            name: item.name, sub: `₹${item.price} • ${item.restName}`,
                            img: item.img, url: `restaurant_menu.html?id=${item.restId}`,
                            nutrition: item.nutrition
                        }))
                    };
                }

                if (intent.query.includes('low cal') || intent.query.includes('calorie') || intent.query.includes('diet') || intent.query.includes('keto') || intent.query.includes('fitness')) {
                    const lightItems = [];
                    for (const [restId, items] of Object.entries(menus)) {
                        const rest = restaurants.find(r => r.id === restId);
                        items.forEach(item => {
                            const nut = estimateNutrition(item.name);
                            if (nut.cal < 400) {
                                lightItems.push({ ...item, nutrition: nut, restName: rest ? rest.name : 'Restaurant', restId });
                            }
                        });
                    }
                    lightItems.sort((a, b) => a.nutrition.cal - b.nutrition.cal);
                    text = "🥬 **Low-calorie picks** to keep you on track:";
                    return {
                        text,
                        cards: lightItems.slice(0, 4).map(item => ({
                            name: item.name, sub: `₹${item.price} • ${item.nutrition.cal} cal`,
                            img: item.img, url: `restaurant_menu.html?id=${item.restId}`,
                            nutrition: item.nutrition
                        }))
                    };
                }

                // General nutrition info
                if (healthGoals) {
                    text += `Your goals: **${healthGoals.calories} cal/day**, **${healthGoals.protein}g protein**\n`;
                }
                text += "Ask me about **high protein**, **low calorie**, or **keto** options!";
                return {
                    text, tags: [
                        { label: '💪 High Protein', query: 'High protein meals' },
                        { label: '🥬 Low Calorie', query: 'Low calorie meals' },
                        { label: '🥑 Keto Options', query: 'Keto friendly food' }
                    ]
                };
            }

            case 'reorder': {
                const history = getOrderHistory();
                if (history.length === 0) {
                    return { text: "You don't have any past orders yet! 🛒 Let me help you find something delicious.", tags: [{ label: '🍽️ Browse Restaurants', query: 'Go to restaurants' }] };
                }
                const lastOrder = history[0];
                return {
                    text: `Your last order was from **${lastOrder.restaurant || 'a restaurant'}** — want me to add those same items to your cart? 🔁`,
                    cards: (lastOrder.items || []).slice(0, 3).map(item => ({
                        name: item.name, sub: `₹${item.price} × ${item.qty || 1}`,
                        img: item.img || '', url: 'shopping_cart.html'
                    })),
                    tags: [{ label: '🛒 Add to Cart', query: 'Yes, reorder' }, { label: '🍽️ Browse New', query: 'Go to restaurants' }]
                };
            }

            case 'order_history': {
                const history = getOrderHistory();
                if (history.length === 0) {
                    return { text: "No order history found yet! Start your ZipZapZoi journey now 🚀", tags: [{ label: '🍽️ Order Now', query: 'Go to restaurants' }] };
                }
                return {
                    text: `Here are your recent orders 📦`,
                    cards: history.slice(0, 3).map(o => ({
                        name: o.restaurant || 'Order', sub: `${o.date || 'Recently'} • ₹${o.total || '?'}`,
                        img: o.image || '', url: 'customer_orders history.html'
                    })),
                    tags: [{ label: '📋 View All Orders', query: 'Go to orders' }]
                };
            }

            case 'general':
            default: {
                // Try matching any restaurant or menu item first
                const q = intent.query || '';
                const matched = restaurants.filter(r =>
                    r.name.toLowerCase().includes(q) ||
                    r.tags.some(t => t.toLowerCase().includes(q))
                );
                if (matched.length > 0) {
                    return {
                        text: `Here's what I found for "${q}" 🔍`,
                        cards: matched.slice(0, 3).map(r => ({
                            name: r.name, sub: `${r.rating}⭐ • ${r.time}`,
                            img: r.image, url: `restaurant_menu.html?id=${r.id}`
                        })),
                        feedbackSource: 'food_search'
                    };
                }
                // STRICT REFUSAL — do NOT guess
                return {
                    text: "🔴 **I don't have enough information to answer that accurately.**\n\nI want to give you the right answer, not a guess. Here's what you can do:\n\n**1.** Try rephrasing your question\n**2.** Choose a topic below\n**3.** [Contact Support →](customer support help.html) for personalized help\n\n📖 *Source: Confidence Validation Layer*",
                    tags: [
                        { label: '🎫 ZoiPass Info', query: 'What is ZoiPass?' },
                        { label: '💰 Refund Policy', query: 'How do I get a refund?' },
                        { label: '🍕 Food Search', query: 'Show me pizza' },
                        { label: '📍 Order Tracking', query: 'Track my order' },
                        { label: '🏪 Partner Help', query: 'Restaurant onboarding' },
                        { label: '🏍️ Rider Info', query: 'Rider payment info' },
                        { label: '🔧 IT Support', query: 'POS not working' }
                    ],
                    feedbackSource: 'fallback_refusal'
                };
            }
        }
    }

    // ─── RENDER HELPERS ─────────────────────────────────────
    function renderMessage(role, content) {
        const body = document.getElementById('zoi-chat-body');
        if (!body) return;

        const div = document.createElement('div');
        div.className = `zoi-msg ${role}`;

        let html = '';

        // Markdown: Enhanced rendering for Gemini responses
        let rawText = content.text || '';
        
        // Code blocks (``` ... ```)
        rawText = rawText.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
            return `<pre style="background:#1a0b36;border:1px solid #3c1e6e;border-radius:8px;padding:10px;margin:6px 0;overflow-x:auto;font-size:12px;font-family:'JetBrains Mono',monospace;color:#e0d4ff"><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
        });
        // Inline code
        rawText = rawText.replace(/`([^`]+)`/g, '<code style="background:#1a0b36;border:1px solid #3c1e6e;padding:1px 5px;border-radius:4px;font-size:12px;color:#00f0ff;font-family:monospace">$1</code>');
        // Headings (### then ## then #)
        rawText = rawText.replace(/^### (.+)$/gm, '<h4 style="color:#00f0ff;font-size:13px;font-weight:800;margin:8px 0 4px">$1</h4>');
        rawText = rawText.replace(/^## (.+)$/gm, '<h3 style="color:#00f0ff;font-size:14px;font-weight:800;margin:8px 0 4px">$1</h3>');
        rawText = rawText.replace(/^# (.+)$/gm, '<h2 style="color:#00f0ff;font-size:15px;font-weight:800;margin:8px 0 4px">$1</h2>');
        // Bold & italic
        rawText = rawText.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#00f0ff">$1</strong>');
        rawText = rawText.replace(/\*(.+?)\*/g, '<em style="color:#b4a5d8">$1</em>');
        // Links
        rawText = rawText.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#00f0ff;text-decoration:underline" target="_blank">$1</a>');
        // Unordered lists (- or *)
        rawText = rawText.replace(/^[\-\*]\s+(.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:#ccc">$1</li>');
        // Ordered lists (1. 2. etc.)
        rawText = rawText.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:16px;list-style:decimal;color:#ccc">$1</li>');
        // Wrap consecutive <li> in <ul>/<ol>
        rawText = rawText.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="margin:4px 0;padding-left:8px">$1</ul>');
        // Line breaks
        rawText = rawText.replace(/\n/g, '<br>');
        // Clean up excessive <br> after block elements
        rawText = rawText.replace(/(<\/(?:h[2-4]|pre|ul|ol|li)>)<br>/g, '$1');

        let text = rawText;
        html += `<div>${text}</div>`;

        // Confidence badge
        if (content.confidenceBadge) {
            const labels = { high: '🟢 Verified Answer', medium: '🟡 Likely Match', low: '🔴 Low Confidence' };
            html += `<span class="zoi-confidence-badge ${content.confidenceBadge}">${labels[content.confidenceBadge] || ''}</span>`;
        }

        // Nutrition pills on cards
        if (content.cards) {
            content.cards.forEach(card => {
                html += `<div class="zoi-card" onclick="window.location.href='${card.url}'">`;
                if (card.img) html += `<img class="zoi-card-img" src="${card.img}" alt="${card.name}" onerror="this.style.display='none'" />`;
                html += `<div class="zoi-card-info"><h5>${card.name}</h5><span>${card.sub}</span>`;
                if (card.nutrition) {
                    html += `<div style="margin-top:4px">`;
                    html += `<span class="zoi-nutrition-pill">🔥 ${card.nutrition.cal} cal</span>`;
                    html += `<span class="zoi-nutrition-pill">💪 ${card.nutrition.protein}g protein</span>`;
                    html += `</div>`;
                }
                html += `</div></div>`;
            });
        }

        // Action tags
        if (content.tags) {
            html += `<div style="margin-top:6px">`;
            content.tags.forEach(tag => {
                html += `<span class="zoi-tag" onclick="document.getElementById('zoi-chat-input').value='${tag.query}';document.getElementById('zoi-chat-send').click()">${tag.label}</span>`;
            });
            html += `</div>`;
        }

        // Feedback buttons (only on bot messages with a source)
        if (role === 'bot' && content.feedbackSource) {
            const src = content.feedbackSource.replace(/'/g, "\\'");
            html += `<div class="zoi-feedback">`;
            html += `<button onclick="window._zoiRecordFeedback('${src}',true);this.classList.add('voted');this.parentElement.querySelectorAll('button').forEach(b=>b.style.pointerEvents='none')">👍 Helpful</button>`;
            html += `<button onclick="window._zoiRecordFeedback('${src}',false);this.classList.add('voted');this.parentElement.querySelectorAll('button').forEach(b=>b.style.pointerEvents='none')">👎 Not helpful</button>`;
            html += `</div>`;
        }

        div.innerHTML = html;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;

        // Execute action if present
        if (content.action) {
            setTimeout(content.action, 1500);
        }
    }

    function showTyping() {
        const body = document.getElementById('zoi-chat-body');
        const typing = document.createElement('div');
        typing.className = 'zoi-typing';
        typing.id = 'zoi-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        body.appendChild(typing);
        body.scrollTop = body.scrollHeight;
    }

    function hideTyping() {
        const t = document.getElementById('zoi-typing');
        if (t) t.remove();
    }

    // ─── QUICK ACTIONS ──────────────────────────────────────
    function renderQuickActions(persona) {
        const container = document.getElementById('zoi-quick-actions');
        if (!container) return;

        let actions = [];

        if (persona === 'admin') {
            actions = [
                { label: '🛡️ Ban User', query: 'How to ban a user' },
                { label: '⚖️ Disputes', query: 'Support tickets' },
                { label: '💻 Health', query: 'System health logs' },
                { label: '🗺️ Zones', query: 'Manage delivery zones' }
            ];
        } else if (persona === 'partner') {
            actions = [
                { label: '🍳 Menu', query: 'How to add menu items' },
                { label: '💰 Payouts', query: 'When is payout' },
                { label: '👥 Staff', query: 'Add staff login' }
            ];
        } else if (persona === 'pos') {
            actions = [
                { label: '🎓 Students', query: 'Register hosteler' },
                { label: '🧾 Split Bill', query: 'Split bill payment' },
                { label: '📦 Stock', query: 'Inventory management' }
            ];
        } else {
            // Customer default
            actions = [
                { label: '🎫 ZoiPass', query: 'What is ZoiPass' },
                { label: '💰 Refunds', query: 'Refund policy' },
                { label: '🔥 Trending', query: 'Popular restaurants' },
                { label: '📋 Orders', query: 'My orders' }
            ];
        }

        container.innerHTML = actions.map(a =>
            `<button class="zoi-quick-btn" onclick="document.getElementById('zoi-chat-input').value='${a.query}';document.getElementById('zoi-chat-send').click()">${a.label}</button>`
        ).join('');
    }

    // ─── MAIN LOGIC ─────────────────────────────────────────
    function handleSend() {
        const input = document.getElementById('zoi-chat-input');
        const text = input.value.trim();
        if (!text) return;

        // Push user context for multi-turn memory
        pushContext('user', text, null);

        // Show user message
        renderMessage('user', { text });
        input.value = '';

        // Show typing indicator
        showTyping();

        // Call Backend Gemini API
        fetch('/api/zoi-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: conversationContext.history })
        })
        .then(res => res.json())
        .then(data => {
            hideTyping();
            const reply = data.response || "Sorry, I couldn't formulate a response right now.";
            pushContext('bot', reply, null);
            renderMessage('bot', { text: reply });
        })
        .catch(err => {
            console.error("Zoi AI Fetch Error:", err);
            hideTyping();
            renderMessage('bot', { text: "🔴 **Network Error!**\n\nI couldn't reach the Zoi Brain server. Please ensure the backend is running." });
        });
    }

    function togglePanel() {
        const panel = document.getElementById('zoi-ai-panel');
        const badge = document.getElementById('zoi-fab-badge');

        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
        } else {
            panel.classList.add('open');
            if (badge) badge.style.display = 'none';

            // Welcome message on first open
            const body = document.getElementById('zoi-chat-body');
            if (body && body.children.length === 0) {
                const hour = new Date().getHours();
                let timeGreeting = 'Good evening';
                if (hour < 12) timeGreeting = 'Good morning';
                else if (hour < 17) timeGreeting = 'Good afternoon';

                // Determine persona styling based on URL
                const path = window.location.pathname.toLowerCase();
                let persona = 'customer';
                let sysName = 'Zoi AI';
                let sysRole = 'Your Personal Concierge';
                let welcomeText = "I can help you discover meals, answer queries, track nutrition, and more. How can I assist you today?";

                if (path.includes('admin')) {
                    persona = 'admin'; sysName = 'Zoi Admin AI'; sysRole = 'System Monitor & Ops';
                    document.getElementById('zoi-ai-fab').style.background = 'linear-gradient(135deg, #ef4444, #f97316)';
                    document.querySelector('.zoi-avatar').style.background = 'linear-gradient(135deg, #ef4444, #f97316)';
                    document.querySelector('.zoi-chat-header .zoi-info p').style.color = '#fca5a5';
                    document.querySelector('.zoi-chat-header .zoi-info p').style.setProperty('--zoi-indicator-color', '#ef4444');
                    welcomeText = "I monitor system health, user moderation, and partner onboarding. What administrative task do you need help with?";
                } else if (path.includes('partner') || path.includes('restaurant_')) {
                    persona = 'partner'; sysName = 'Zoi Partner AI'; sysRole = 'Restaurant Operations';
                    document.getElementById('zoi-ai-fab').style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                    document.querySelector('.zoi-avatar').style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                    welcomeText = "I can help you manage your menu, staff logins, and view payout reports. How can I help your restaurant grow?";
                } else if (path.includes('pos') || path.includes('hostel')) {
                    persona = 'pos'; sysName = 'Zoi POS AI'; sysRole = 'Cashier Assistant';
                    document.getElementById('zoi-ai-fab').style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
                    document.querySelector('.zoi-avatar').style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
                    welcomeText = "I can help you split bills, add hostelers, and manage your offline inventory. What do you need help with?";
                }

                // Update UI headers
                const headerName = document.querySelector('.zoi-chat-header .zoi-info h4');
                const headerRole = document.querySelector('.zoi-chat-header .zoi-info p');
                if (headerName) headerName.textContent = sysName;
                if (headerRole) {
                    headerRole.innerHTML = headerRole.innerHTML.replace('Your Food Concierge', sysRole);
                }

                const profile = getUserProfile();
                renderMessage('bot', {
                    text: `${timeGreeting}${profile.name ? ', ' + profile.name : ''}! 👋 I'm **${sysName}**.\n\n${welcomeText}`
                });
                renderQuickActions(persona);
            }

            // Focus input
            setTimeout(() => document.getElementById('zoi-chat-input')?.focus(), 300);
        }
    }

    // ─── INIT ───────────────────────────────────────────────
    function init() {
        // Universal initialization - AI runs on ALL pages now!

        // Inject styles
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        // Inject HTML
        const wrapper = document.createElement('div');
        wrapper.id = 'zoi-ai-wrapper';
        wrapper.innerHTML = FAB_HTML + PANEL_HTML;
        document.body.appendChild(wrapper);

        // Event listeners
        document.getElementById('zoi-ai-fab').addEventListener('click', togglePanel);
        document.getElementById('zoi-chat-close').addEventListener('click', togglePanel);
        document.getElementById('zoi-chat-send').addEventListener('click', handleSend);
        document.getElementById('zoi-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSend();
        });

        // Show notification badge after 3 seconds
        setTimeout(() => {
            const badge = document.getElementById('zoi-fab-badge');
            const panel = document.getElementById('zoi-ai-panel');
            if (badge && panel && !panel.classList.contains('open')) {
                badge.style.display = 'flex';
            }
        }, 3000);
    }

    // Boot when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
