#!/usr/bin/env node
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main(){
  try {
    const isoStart = '2026-01-05T00:00:00.000Z';
    const isoEnd = '2026-01-13T00:00:00.000Z';
    console.log('Checking marketplacePayoutWeek rows for statementNumber contains 260105 or weekStart in', isoStart, '->', isoEnd);
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: {
        OR: [
          { statementNumber: { contains: '260105' } },
          { weekStart: { gte: new Date(isoStart), lt: new Date(isoEnd) } },
        ],
      },
      orderBy: [{ accountId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, accountId: true, statementNumber: true, payoutAmount: true, grossSales: true, currency: true, isPaid: true, rawPayload: true, createdAt: true, weekStart: true },
    });
    console.log(`Found ${rows.length} rows:`);
    for (const r of rows) {
      const placeholder = !!(r.rawPayload && r.rawPayload.placeholder === true);
      console.log({ id: r.id, accountId: r.accountId, statementNumber: r.statementNumber, payoutAmount: String(r.payoutAmount ?? null), grossSales: String(r.grossSales ?? null), currency: r.currency, isPaid: r.isPaid, placeholder, createdAt: r.createdAt });
    }
    process.exit(0);
  } catch (e) {
    console.error('check failed', e);
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(()=>{});
  }
})();
