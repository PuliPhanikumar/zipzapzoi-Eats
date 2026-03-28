/**
 * ZipZapZoi Eats — Database Seed Script
 * Creates initial data for development and testing.
 * 
 * Run: cd backend && node seed.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding ZipZapZoi Eats Database...\n');

    // ─── ADMIN USER ─────────────────────────────────────
    const adminHash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@zipzapzoi.in' },
        update: {},
        create: {
            zoiId: 'ADM-01',
            name: 'Zoi Admin',
            email: 'admin@zipzapzoi.in',
            phone: '9999999999',
            role: 'Super Admin',
            passwordHash: adminHash,
            status: 'Active'
        }
    });
    console.log('✅ Admin user created:', admin.zoiId);

    // ─── DEMO CUSTOMER ──────────────────────────────────
    const custHash = await bcrypt.hash('customer123', 12);
    const customer = await prisma.user.upsert({
        where: { email: 'customer@zipzapzoi.in' },
        update: {},
        create: {
            zoiId: 'CUST-001',
            name: 'Anil Kumar',
            email: 'customer@zipzapzoi.in',
            phone: '9876543210',
            role: 'Customer',
            passwordHash: custHash,
            status: 'Active'
        }
    });
    console.log('✅ Customer user created:', customer.zoiId);

    // ─── DEMO PARTNER ───────────────────────────────────
    const partnerHash = await bcrypt.hash('partner123', 12);
    const partner = await prisma.user.upsert({
        where: { email: 'partner@zipzapzoi.in' },
        update: {},
        create: {
            zoiId: 'PART-001',
            name: 'Rajesh Sharma',
            email: 'partner@zipzapzoi.in',
            phone: '9876543211',
            role: 'partner',
            passwordHash: partnerHash,
            status: 'Active'
        }
    });
    console.log('✅ Partner user created:', partner.zoiId);

    // ─── DEMO RIDER ─────────────────────────────────────
    const riderHash = await bcrypt.hash('rider123', 12);
    const rider = await prisma.user.upsert({
        where: { email: 'rider@zipzapzoi.in' },
        update: {},
        create: {
            zoiId: 'RIDE-001',
            name: 'Vikram Das',
            email: 'rider@zipzapzoi.in',
            phone: '9876543212',
            role: 'rider',
            passwordHash: riderHash,
            status: 'Active'
        }
    });
    console.log('✅ Rider user created:', rider.zoiId);

    // ─── RESTAURANTS ────────────────────────────────────
    const rest1 = await prisma.restaurant.upsert({
        where: { zoiId: 'REST-101' },
        update: {},
        create: {
            zoiId: 'REST-101',
            name: 'Spice Symphony',
            ownerName: 'Rajesh Sharma',
            ownerEmail: 'partner@zipzapzoi.in',
            phone: '+91 9876543211',
            address: '12, MG Road, Indiranagar, Bengaluru',
            tags: ['North Indian', 'Biryani', 'Tandoor'],
            status: 'Active',
            rating: 4.5,
            plan: 'Gold',
            zone: 'Indiranagar',
            deliveryTime: '30 min',
            costForTwo: '₹400 for two',
            promoted: true,
            offer: '20% OFF up to ₹50'
        }
    });

    const rest2 = await prisma.restaurant.upsert({
        where: { zoiId: 'REST-102' },
        update: {},
        create: {
            zoiId: 'REST-102',
            name: 'Pizza Planet',
            ownerName: 'Amit Patel',
            phone: '+91 9876543213',
            address: '45, HSR Layout, Bengaluru',
            tags: ['Pizza', 'Italian', 'Fast Food'],
            status: 'Active',
            rating: 4.3,
            plan: 'Starter',
            zone: 'HSR Layout',
            deliveryTime: '25 min',
            costForTwo: '₹350 for two'
        }
    });

    const rest3 = await prisma.restaurant.upsert({
        where: { zoiId: 'REST-103' },
        update: {},
        create: {
            zoiId: 'REST-103',
            name: 'Sushi Garden',
            ownerName: 'Priya Patel',
            phone: '+91 9876543214',
            address: '78, Koramangala, Bengaluru',
            tags: ['Japanese', 'Sushi', 'Asian'],
            status: 'Active',
            rating: 4.7,
            plan: 'Platinum',
            zone: 'Koramangala',
            deliveryTime: '40 min',
            costForTwo: '₹600 for two'
        }
    });
    console.log('✅ 3 restaurants created');

    // ─── MENUS ──────────────────────────────────────────
    await prisma.menu.createMany({
        data: [
            // Spice Symphony
            { restaurantId: rest1.id, itemName: 'Chicken Biryani', price: 299, category: 'Recommended', type: 'Non-Veg', description: 'Aromatic basmati rice with tender chicken', isBestseller: true, isAvailable: true },
            { restaurantId: rest1.id, itemName: 'Paneer Tikka', price: 249, category: 'Starters', type: 'Veg', description: 'Chargrilled cottage cheese with spices', isBestseller: true, isAvailable: true },
            { restaurantId: rest1.id, itemName: 'Butter Naan', price: 49, category: 'Breads', type: 'Veg', description: 'Soft naan brushed with butter', isAvailable: true },
            { restaurantId: rest1.id, itemName: 'Dal Makhani', price: 199, category: 'Mains', type: 'Veg', description: 'Creamy black lentils slow-cooked overnight', isAvailable: true },
            { restaurantId: rest1.id, itemName: 'Gulab Jamun', price: 99, category: 'Desserts', type: 'Veg', description: 'Deep-fried dough balls in syrup', isAvailable: true },
            // Pizza Planet
            { restaurantId: rest2.id, itemName: 'Margherita Pizza', price: 199, category: 'Recommended', type: 'Veg', isBestseller: true, isAvailable: true },
            { restaurantId: rest2.id, itemName: 'Cheesy 7 Pizza', price: 449, category: 'Recommended', type: 'Veg', description: '7 types of cheese on a crunchy base', isAvailable: true },
            { restaurantId: rest2.id, itemName: 'Garlic Bread', price: 129, category: 'Sides', type: 'Veg', isAvailable: true },
            { restaurantId: rest2.id, itemName: 'Pepperoni Pizza', price: 399, category: 'Mains', type: 'Non-Veg', isAvailable: true },
            // Sushi Garden
            { restaurantId: rest3.id, itemName: 'California Roll', price: 349, category: 'Recommended', type: 'Non-Veg', isBestseller: true, isAvailable: true },
            { restaurantId: rest3.id, itemName: 'Miso Ramen', price: 299, category: 'Mains', type: 'Non-Veg', description: 'Rich miso broth with noodles', isAvailable: true },
            { restaurantId: rest3.id, itemName: 'Edamame', price: 149, category: 'Starters', type: 'Veg', isAvailable: true },
        ],
        skipDuplicates: true
    });
    console.log('✅ 12 menu items created');

    // ─── ZONES ──────────────────────────────────────────
    await prisma.zone.createMany({
        data: [
            { name: 'Indiranagar', lat: 12.9716, lng: 77.6412, radius: 5000 },
            { name: 'Koramangala', lat: 12.9352, lng: 77.6245, radius: 5000 },
            { name: 'HSR Layout', lat: 12.9116, lng: 77.6474, radius: 4000 },
            { name: 'South Delhi', lat: 28.5355, lng: 77.2500, radius: 6000 },
            { name: 'Connaught Place', lat: 28.6315, lng: 77.2167, radius: 3000 },
        ],
        skipDuplicates: true
    });
    console.log('✅ 5 zones created');

    // ─── PROMOTIONS ─────────────────────────────────────
    await prisma.promotion.createMany({
        data: [
            { code: 'WELCOME50', type: 'percentage', value: 50, cap: 100, maxUsage: 10000, description: 'New user 50% off, up to ₹100' },
            { code: 'FLAT20', type: 'flat', value: 20, maxUsage: 5000, description: 'Flat ₹20 off on all orders' },
            { code: 'ZOIGOLD', type: 'percentage', value: 30, cap: 150, maxUsage: 1000, description: 'Gold members 30% off, up to ₹150' },
        ],
        skipDuplicates: true
    });
    console.log('✅ 3 promotions created');

    // ─── ADMIN WALLET ───────────────────────────────────
    await prisma.wallet.upsert({
        where: { entityId: 'ADMIN' },
        update: {},
        create: { entityId: 'ADMIN', entityType: 'Admin', balance: 0 }
    });
    console.log('✅ Admin wallet created');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Demo Credentials:');
    console.log('  Admin:    admin@zipzapzoi.in / admin123');
    console.log('  Customer: customer@zipzapzoi.in / customer123');
    console.log('  Partner:  partner@zipzapzoi.in / partner123');
    console.log('  Rider:    rider@zipzapzoi.in / rider123');
}

main()
    .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
