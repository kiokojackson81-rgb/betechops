const { PrismaClient } = require('@prisma/client');

// Usage:
// $env:DATABASE_URL="..."; node scripts/align-ledger-period.js <LEDGER_ID> <START_ISO> <END_ISO>

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main(){
  const id = process.argv[2];
  const startStr = process.argv[3];
  const endStr = process.argv[4];
  if (!id || !startStr || !endStr){
    console.error('Usage: node scripts/align-ledger-period.js <LEDGER_ID> <START_ISO> <END_ISO>');
    process.exit(1);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  const updated = await prisma.commissionLedger.update({ where: { id }, data: { periodStart: start, periodEnd: end } });
  console.log('Updated ledger', updated.id, 'periodStart=', updated.periodStart, 'periodEnd=', updated.periodEnd);
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
