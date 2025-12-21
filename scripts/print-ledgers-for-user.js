const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || 'stephen@betech.co.ke';
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error('User not found', email); process.exitCode = 2; return; }
    const ledgers = await prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: { periodStart: 'asc' } });
    console.log(`Found ${ledgers.length} ledger(s) for ${email}`);
    for (const l of ledgers) {
      console.log('---');
      console.log('id:', l.id);
      console.log('periodStart:', l.periodStart && l.periodStart.toISOString());
      console.log('periodEnd:', l.periodEnd && l.periodEnd.toISOString());
      console.log('commissionTotal:', l.commissionTotal);
      console.log('grossCommission:', l.grossCommission, 'netCommission:', l.netCommission, 'penalties:', l.penalties);
      console.log('detail.marketing.commission:', l.detail?.marketing?.commission);
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
