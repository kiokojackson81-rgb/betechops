const { PrismaClient } = require('@prisma/client');

// Usage:
// $env:DATABASE_URL="postgresql://..."; node scripts/keep-latest-commission-ledger.js brendah@betech.co.ke 2025-12-25T00:00:00.000Z 2026-01-24T23:59:59.999Z

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main(){
  const email = process.argv[2];
  const startStr = process.argv[3];
  const endStr = process.argv[4];
  if (!email || !startStr || !endStr){
    console.error('Usage: node scripts/keep-latest-commission-ledger.js <EMAIL> <START_ISO> <END_ISO>');
    process.exit(1);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found for email', email);
    process.exit(1);
  }

  const ledgers = await prisma.commissionLedger.findMany({
    where: { userId: user.id, periodStart: start, periodEnd: end },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, createdAt: true }
  });

  if (!ledgers || ledgers.length <= 1){
    console.log('No extra ledgers to delete. Count =', ledgers.length);
    await prisma.$disconnect();
    return;
  }

  const keep = ledgers[0].id;
  const toDelete = ledgers.slice(1).map(l => l.id);

  const res = await prisma.commissionLedger.deleteMany({ where: { id: { in: toDelete } } });
  console.log('Kept ledger id:', keep, 'Deleted count:', res.count);
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
