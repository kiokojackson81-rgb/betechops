// scripts/clear-marketing-submitter.js
// Usage (dry-run):
//   DATABASE_URL="..." node scripts/clear-marketing-submitter.js --user-ids=cmimxqfgo0004v5mc5pn1r486,cmimxqfve0006v5mcewkm8waa --from=2025-11-24 --to=2025-12-24
// To apply (dangerous):
//   DATABASE_URL="..." APPLY=true node scripts/clear-marketing-submitter.js --user-ids=... --from=2025-11-24 --to=2025-12-24

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const argv = require('minimist')(process.argv.slice(2));

const userIdsArg = argv['user-ids'] || argv['userIds'] || argv['userId'];
const dailyIdsArg = argv['daily-ids'] || argv['dailyIds'] || argv['dailyId'];
const fromArg = argv.from || argv.start || null;
const toArg = argv.to || argv.end || null;
const apply = Boolean(process.env.APPLY);

if (!userIdsArg && !dailyIdsArg) {
  console.error('Specify --user-ids or --daily-ids');
  process.exit(2);
}

const userIds = userIdsArg ? String(userIdsArg).split(',').map(s => s.trim()).filter(Boolean) : [];
const dailyIds = dailyIdsArg ? String(dailyIdsArg).split(',').map(s => s.trim()).filter(Boolean) : [];

(async () => {
  try {
    const where = {};
    if (dailyIds.length) {
      where.id = { in: dailyIds };
    } else if (userIds.length) {
      where.submittedById = { in: userIds };
    }
    if (fromArg || toArg) {
      where.date = {};
      if (fromArg) where.date.gte = new Date(fromArg);
      if (toArg) where.date.lte = new Date(toArg);
    }

    const rows = await prisma.marketingDailyEntry.findMany({ where, select: { id: true, date: true, submittedById: true, totalSales: true, totalProfit: true }, orderBy: { date: 'desc' } });
    console.log('Found', rows.length, 'marketing_daily_entry rows matching filter');
    rows.forEach(r => console.log(r.id, r.date && r.date.toISOString().slice(0,10), 'submittedById=', r.submittedById, 'totalSales=', r.totalSales));

    if (!rows.length) {
      console.log('Nothing to do.');
      return;
    }

    if (!apply) {
      console.log('\nDRY RUN only. To apply changes set env APPLY=true and re-run.');
      return;
    }

    // Apply update in a transaction for safety
    const ids = rows.map(r => r.id);
    await prisma.$transaction(async (tx) => {
      console.log('Updating', ids.length, 'rows to set submittedById = NULL');
      await tx.marketingDailyEntry.updateMany({ where: { id: { in: ids } }, data: { submittedById: null } });
      // Optionally, also null submittedByName/email in related receipts? We skip that to be conservative.
    });

    console.log('Update applied.');
  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
