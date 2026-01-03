#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){
  const userId = process.argv[2];
  if(!userId){ console.error('Usage: node scripts/list-ledgers-for-user.js <USER_ID>'); process.exit(1); }
  try{
    const rows = await prisma.commissionLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    console.log('CommissionLedger rows for', userId, 'count=', rows.length);
    rows.forEach(r => console.log({ id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, commissionTotal: r.commissionTotal || r.commission, grossCommission: r.grossCommission, netCommission: r.netCommission, createdAt: r.createdAt }));
  }catch(e){ console.error(e); process.exitCode=1; }
  finally{ await prisma.$disconnect(); }
}
main();
