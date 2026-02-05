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
      // aggregate by weekStart/weekEnd to collapse duplicates
      const map = new Map();
      for (const r of rows) {
        const key = `${new Date(r.weekStart).toISOString()}::${new Date(r.weekEnd).toISOString()}`;
        map.set(key, (map.get(key) || 0) + Number(r.payoutAmount ?? r.grossSales ?? 0));
      }
      const sum = Array.from(map.values()).reduce((s, v) => s + v, 0);
      console.log(`${acct.displayName ?? acct.id} -> ${sum.toFixed(2)} (${map.size} aggregated weeks, ${rows.length} raw rows)`);
    }

    console.log('Done');
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
