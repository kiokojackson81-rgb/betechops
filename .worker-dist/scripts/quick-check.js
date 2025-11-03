"use strict";
(async () => {
    require('dotenv').config();
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    try {
        const shops = await p.shop.findMany({ select: { id: true, name: true, platform: true } });
        console.log('Shops:', shops);
    }
    catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    }
    finally {
        await p.$disconnect();
    }
})();
