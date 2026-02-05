#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  try{
    const weekStart = new Date('2026-01-05T00:00:00.000Z');
    console.log('Listing marketplacePayoutWeek rows for weekStart=', weekStart.toISOString());
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart },
      include: { account: { select: { id: true, displayName: true, platform: true } } },
      orderBy: [{ accountId: 'asc' }, { statementNumber: 'asc' }],
    });
    if (!rows.length) {
      console.log('No rows found for', weekStart.toISOString());
    } else {
      for (const r of rows) {
        console.log(JSON.stringify({ accountId: r.accountId, accountName: r.account?.displayName, statementNumber: r.statementNumber, grossSales: r.grossSales?.toString(), payoutAmount: r.payoutAmount?.toString(), rawPayload: r.rawPayload }, null, 2));
      }
    }
  }catch(e){ console.error('ERR', e); process.exitCode = 1; } finally { await prisma.$disconnect(); }
}

main();
