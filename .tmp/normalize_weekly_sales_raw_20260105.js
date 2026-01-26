require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function(){
  try {
    const canonicalStart = '2026-01-04T00:00:00Z';
    const canonicalEnd = '2026-01-11T00:00:00Z';
    const windowStart = '2026-01-03T12:00:00Z';
    const windowEnd = '2026-01-06T12:00:00Z';
    const sql = `
      UPDATE "WeeklySale"
      SET "weekStart" = '${canonicalStart}'::timestamptz, "weekEnd" = '${canonicalEnd}'::timestamptz
      WHERE "weekStart" >= '${windowStart}'::timestamptz AND "weekStart" < '${windowEnd}'::timestamptz
        AND source = 'AUTOMATIC'
    `;
    const res = await prisma.$executeRawUnsafe(sql);
    console.log('Rows updated:', res);
  } catch (e) {
    console.error('failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
