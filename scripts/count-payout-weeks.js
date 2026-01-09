#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
(async ()=>{
  try{
    const ws = new Date('2026-01-05T00:00:00.000Z');
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: ws }, select: { id: true, statementNumber: true, accountId: true, grossSales: true } });
    console.log('Found', rows.length, 'payout weeks for 2026-01-05');
    rows.forEach(r=> console.log(r.statementNumber, r.accountId, r.grossSales));
  }catch(e){ console.error('ERR', e.message||e); process.exit(1);} finally{ await prisma.$disconnect(); }
})();
