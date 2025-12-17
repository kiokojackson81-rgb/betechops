const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.USER_EMAIL || process.argv[2] || 'stephen@betech.co.ke';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('User not found:', email); process.exit(2); }
  const now = new Date();
  const d = new Date(now); d.setHours(0,0,0,0);
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  // derive period same as other scripts
  const periodStart = (day >= 25) ? new Date(year, month, 25) : new Date(year, month - 1, 25);
  const periodEnd = (day >= 25) ? new Date(year, month + 1, 24, 23, 59, 59, 999) : new Date(year, month, 24, 23, 59, 59, 999);
  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } } });
  console.log('ledger:', ledger);
  await prisma.$disconnect();
}

main().catch(e=>{console.error(e); process.exit(1);});
