"use strict";
// scripts/count-jumia.js
const { PrismaClient } = require('@prisma/client');
async function run() {
    const prisma = new PrismaClient({ log: ['warn', 'error'] });
    try {
        const accounts = await prisma.jumiaAccount.findMany({
            include: { shops: true },
        });
        const shopsCount = await prisma.jumiaShop.count();
        const ordersCount = await prisma.jumiaOrder.count().catch(() => null);
        console.log('JumiaAccount count:', accounts.length);
        for (const a of accounts) {
            const cid = (a.clientId || '').slice(0, 8) + '...';
            const rtLen = a.refreshToken ? String(a.refreshToken).length : 0;
            console.log(`- ${a.label || a.id} (id=${a.id}) shops=${a.shops.length} clientId=${cid} refreshTokenLen=${rtLen}`);
        }
        console.log('JumiaShop count:', shopsCount);
        if (ordersCount !== null)
            console.log('JumiaOrder count:', ordersCount);
    }
    catch (e) {
        console.error('count-jumia error:', (e === null || e === void 0 ? void 0 : e.message) || e);
        process.exitCode = 1;
    }
    finally {
        try {
            await prisma.$disconnect();
        }
        catch (_a) { }
    }
}
run();
