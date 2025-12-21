(async () => {
  try {
    const userId = process.env.USER_ID || process.argv[2];
    const periodStartStr = process.env.PERIOD_START || process.argv[3] || '2025-11-25';
    const periodEndStr = process.env.PERIOD_END || process.argv[4] || '2025-12-24';
    if (!userId) {
      console.error('Usage: node zero-commission-by-userid.js <userId> [periodStart] [periodEnd]');
      process.exitCode = 2;
      return;
    }
    console.log(`Zeroing commission for userId=${userId} period ${periodStartStr} -> ${periodEndStr}`);
    const { prisma } = require('../src/lib/prisma');
    const start = new Date(periodStartStr);
    const end = new Date(periodEndStr);

    // Check existing
    const existing = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: start, periodEnd: end } } });
    if (existing) {
      console.log('Existing ledger found, updating to zero. id=', existing.id);
      await prisma.commissionLedger.update({
        where: { id: existing.id },
        data: { grossCommission: 0, netCommission: 0, detail: { ...(existing.detail || {}), marketing: { ...(existing.detail?.marketing || {}), commission: 0, computedAt: new Date().toISOString() } } },
      });
      console.log('Updated ledger to zero.');
    } else {
      console.log('No existing ledger — creating zeroed ledger.');
      const detail = { marketing: { periodKey: `${periodStartStr.replace(/-/g, '_')}_${periodEndStr.replace(/-/g, '_')}`, totals: {}, commission: 0, computedAt: new Date().toISOString() } };
      const created = await prisma.commissionLedger.create({ data: { userId, periodStart: start, periodEnd: end, grossCommission: 0, netCommission: 0, detail } });
      console.log('Created ledger id=', created.id);
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    try { const { prisma } = require('../src/lib/prisma'); if (prisma) await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
