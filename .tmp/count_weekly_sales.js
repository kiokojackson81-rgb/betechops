require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function(){
  try {
    const rows = await prisma.weeklySale.findMany({ where: { weekStart: { gte: new Date('2026-01-03T12:00:00Z'), lt: new Date('2026-01-06T12:00:00Z') } } });
    console.log('weeklySale rows:', rows.length);
    for (const r of rows) console.log(r.shopId, String(r.amount), r.source, r.platform);
  } catch (e) {
    console.error('failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
