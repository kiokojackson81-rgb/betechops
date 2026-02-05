try { require('dotenv').config(); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

(async () => {
  try {
    const stmt = process.argv[2] || 'PS260105KE12DWN';
    const row = await prisma.marketplacePayoutWeek.findFirst({
      where: { statementNumber: stmt },
      include: { account: true },
    });
    if (!row) {
      console.log('No row found for', stmt);
      process.exit(0);
    }
    console.log('id:', row.id);
    console.log('accountId:', row.accountId, 'displayName:', row.account?.displayName ?? null);
    console.log('statementNumber:', row.statementNumber);
    console.log('weekStart -> weekEnd:', row.weekStart?.toISOString(), '->', row.weekEnd?.toISOString());
    console.log('grossSales:', String(row.grossSales), 'payoutAmount:', String(row.payoutAmount), 'currency:', row.currency, 'isPaid:', row.isPaid);
    console.log('createdAt:', row.createdAt?.toISOString(), 'updatedAt:', row.updatedAt?.toISOString());
    console.log('rawPayload:');
    console.log(JSON.stringify(row.rawPayload, null, 2));
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
