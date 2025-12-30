#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const userId = process.argv[2];
  const keepId = process.argv[3];
  if(!userId){ console.error('Usage: node scripts/delete-stale-ledgers.js <USER_ID> [KEEP_LEDGER_ID]'); process.exit(1); }
  const thresholdDays = Number(process.env.THRESHOLD_DAYS || '60');
  const since = new Date(Date.now() - thresholdDays * 24 * 3600 * 1000);
  try{
    const rows = await prisma.commissionLedger.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } });
    console.log('Found ledgers:', rows.length);
    const toDelete = rows.filter(r => (keepId ? r.id !== keepId : true));
    if(!toDelete.length){ console.log('Nothing to delete'); return; }
    const ids = toDelete.map(r=>r.id);
    const res = await prisma.commissionLedger.deleteMany({ where: { id: { in: ids } } });
    console.log('Deleted commission ledger rows:', res.count);
  }catch(e){ console.error('ERR', e); process.exitCode=1; }
  finally{ await prisma.$disconnect(); }
}

main();
