const { PrismaClient, Platform } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArg(idx, def) { return process.argv[idx] || def; }

(async () => {
  try {
    const startArg = parseArg(2, '2025-12-29');
    const endArg = parseArg(3, '2026-01-04');
    const start = new Date(startArg + 'T00:00:00');
    const end = new Date(endArg + 'T23:59:59.999');
    console.log('Period:', startArg, '->', endArg);

    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: Platform.JUMIA }, orderBy: { displayName: 'asc' } });
    for (const acct of accounts) {
      const rows = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: acct.id, AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] } });
      const sum = rows.reduce((s, r) => s + Number(r.payoutAmount ?? 0), 0);
      console.log(`${acct.displayName ?? acct.id} -> ${sum.toFixed(2)} (${rows.length} stmt rows)`);
    }

    console.log('Done');
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
