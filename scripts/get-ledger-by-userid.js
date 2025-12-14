(async () => {
  try {
    const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
    const periodStartStr = process.argv[3] || '2025-11-25';
    const periodEndStr = process.argv[4] || '2025-12-24';
    console.log(`Fetching ledger for userId=${userId} period ${periodStartStr} -> ${periodEndStr}`);
    const { prisma } = require('../src/lib/prisma');
    const start = new Date(periodStartStr);
    const end = new Date(periodEndStr);
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: start, periodEnd: end } } });
    console.log(JSON.stringify(ledger, null, 2));
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    try { const { prisma } = require('../src/lib/prisma'); if (prisma) await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
