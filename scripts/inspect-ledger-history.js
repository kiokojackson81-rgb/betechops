const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] || process.env.USER_EMAIL;
    if (!email) {
      console.error('Usage: node scripts/inspect-ledger-history.js <email>');
      process.exit(2);
    }
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!user) {
      console.error('User not found:', email);
      process.exit(2);
    }
    console.log('Inspecting commissionLedger for', user.email, 'id=', user.id);
    const rows = await prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] });
    console.log('Found', rows.length, 'ledger rows');
    rows.forEach((r) => {
      console.log('---');
      console.log('id:', r.id);
      console.log('period:', r.periodStart?.toISOString(), '->', r.periodEnd?.toISOString());
      console.log('createdAt:', r.createdAt?.toISOString(), 'updatedAt:', r.updatedAt?.toISOString());
      console.log('grossCommission:', r.grossCommission, 'netCommission:', r.netCommission, 'commissionTotal:', r.commissionTotal, 'penalties:', r.penalties);
      console.log('commissionBreakdown:', r.commissionBreakdown);
      console.log('detail (marketing):', r.detail && r.detail.marketing ? r.detail.marketing : null);
      console.log('detail (support):', r.detail && r.detail.support ? r.detail.support : null);
      console.log('detail full:', JSON.stringify(r.detail));
    });
  } catch (e) {
    console.error('Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
