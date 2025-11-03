#!/usr/bin/env node
"use strict";
/*
  scripts/lookup-shop.js
  Usage: node scripts/lookup-shop.js "JM Collection" JUMIA
*/
const { PrismaClient, Platform } = require('@prisma/client');
(async () => {
    const name = process.argv[2];
    const platformArg = process.argv[3];
    if (!name) {
        console.error('Usage: node scripts/lookup-shop.js "<Shop Name>" [JUMIA|KILIMALL]');
        process.exit(1);
    }
    const prisma = new PrismaClient();
    try {
        const where = {
            name: { equals: name, mode: 'insensitive' },
        };
        if (platformArg) {
            const p = String(platformArg).toUpperCase();
            if (p === 'JUMIA')
                where.platform = Platform.JUMIA;
            else if (p === 'KILIMALL')
                where.platform = Platform.KILIMALL;
        }
        const shop = await prisma.shop.findFirst({
            where,
            select: { id: true, name: true, platform: true, isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        if (!shop) {
            console.error('Shop not found');
            process.exit(2);
        }
        console.log(JSON.stringify({ ok: true, shop }, null, 2));
    }
    catch (e) {
        console.error('Error:', e.message || e);
        process.exit(3);
    }
    finally {
        await prisma.$disconnect();
    }
})();
