const { PrismaClient } = require('@prisma/client');

// Usage:
// $env:DATABASE_URL="..."; node scripts/delete-all-ledgers-for-period.js brendah@betech.co.ke 2025-12-25T00:00:00.000Z 2026-01-24T23:59:59.999Z

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main(){
  const email = process.argv[2];
  const startStr = process.argv[3];
  const endStr = process.argv[4];
  if (!email || !startStr || !endStr){
    console.error('Usage: node scripts/delete-all-ledgers-for-period.js <EMAIL> <START_ISO> <END_ISO>');
    process.exit(1);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user){ console.error('User not found', email); process.exit(1); }

  const result = await prisma.commissionLedger.deleteMany({ where: { userId: user.id, periodStart: start, periodEnd: end } });
  console.log('Deleted commission ledger rows for user/period:', result.count);
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
