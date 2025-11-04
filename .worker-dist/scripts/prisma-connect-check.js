"use strict";
// Quick Prisma connectivity check to Neon
const { PrismaClient } = require('@prisma/client');
async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('Missing DATABASE_URL in env');
        process.exit(1);
    }
    console.log('[check] Using DATABASE_URL host:', (new URL(url)).host);
    const prisma = new PrismaClient({ log: ['info', 'warn', 'error'] });
    try {
        const r = await prisma.$queryRaw `SELECT 1 as ok`;
        console.log('[check] prisma query ok:', r);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((e) => {
    console.error('[check] prisma failed:', e);
    process.exit(1);
});
