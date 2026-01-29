const { PrismaClient } = require('@prisma/client');

// Usage:
// $env:DATABASE_URL="..."; node scripts/list-ledgers-for-user.js brendah@betech.co.ke

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main(){
  const email = process.argv[2];
  if (!email){ console.error('Usage: node scripts/list-ledgers-for-user.js <EMAIL>'); process.exit(1); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user){ console.error('User not found', email); process.exit(1); }

  const ledgers = await prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: 'desc' }] });
  console.log(JSON.stringify(ledgers.map(l => ({ id: l.id, createdAt: l.createdAt, periodStart: l.periodStart, periodEnd: l.periodEnd, commissionTotal: l.commissionTotal })), null, 2));
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
