"use strict";
// scripts/db-check.js
const { PrismaClient } = require('@prisma/client');
async function run() {
    const prisma = new PrismaClient({ log: ['warn', 'error'] });
    try {
        const meta = await prisma.$queryRawUnsafe('select current_database() as db, current_schema() as schema;');
        console.log('DB meta:', JSON.stringify(meta));
        const table = await prisma.$queryRawUnsafe("select exists (select 1 from information_schema.tables where table_schema='public' and table_name='CatalogCounters') as exists;");
        console.log('CatalogCounters table exists:', JSON.stringify(table));
        if (table && table[0] && table[0].exists) {
            const count = await prisma.$queryRawUnsafe('select count(*)::int as count from "CatalogCounters";');
            console.log('CatalogCounters row count:', JSON.stringify(count));
            const latest = await prisma.$queryRawUnsafe('select scope, "shopId", total, active, "qcApproved", approx, "computedAt" from "CatalogCounters" order by "computedAt" desc limit 10;');
            console.log('Latest rows:', JSON.stringify(latest));
        }
    }
    catch (e) {
        console.error('db-check error:', e && e.message ? e.message : e);
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
