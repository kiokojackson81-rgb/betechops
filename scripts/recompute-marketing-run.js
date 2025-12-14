(async () => {
  try {
    const { prisma } = require('../src/lib/prisma');
    const { recomputeMarketingCommissionLedger } = require('../src/lib/marketingPeriodTotals');

    const email = process.env.USER_EMAIL || process.argv[2] || 'brendah@betech.co.ke';
    console.log(`Running recompute for ${email}`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      process.exitCode = 2;
      return;
    }

    const res = await recomputeMarketingCommissionLedger({ userId: user.id });
    console.log('Recompute result:', res);
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error running recompute:', e);
    try {
      const { prisma } = require('../src/lib/prisma');
      if (prisma && typeof prisma.$disconnect === 'function') await prisma.$disconnect();
    } catch (_) {}
    process.exit(1);
  }
})();
