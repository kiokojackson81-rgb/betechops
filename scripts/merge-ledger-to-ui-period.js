const { PrismaClient } = require('@prisma/client');

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end, key: `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}` };
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] || process.env.USER_EMAIL;
    const dateArg = process.argv[3] || new Date().toISOString().slice(0,10);
    if (!email) {
      console.error('Usage: node scripts/merge-ledger-to-ui-period.js <email> [date]');
      process.exit(2);
    }
    const period = getTradingPeriodFor(new Date(dateArg));
    console.log('Period:', period.start.toISOString(), '->', period.end.toISOString());

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) { console.error('User not found'); process.exit(2); }

    // Find candidate ledgers for this user within +/-1 day of period.start
    const windowStart = new Date(period.start.getTime() - 24*60*60*1000);
    const windowEnd = new Date(period.start.getTime() + 24*60*60*1000);

    const ledgers = await prisma.commissionLedger.findMany({ where: { userId: user.id, periodStart: { gte: windowStart, lte: windowEnd } }, orderBy: [{ periodStart: 'asc' }] });

    console.log('Found ledgers near period start:', ledgers.map(l => ({ id: l.id, periodStart: l.periodStart, commissionTotal: l.commissionTotal, gross: l.grossCommission })));

    if (ledgers.length < 2) {
      console.log('No duplicate ledgers to merge; nothing to do.');
      process.exit(0);
    }

    // Pick source = ledger with marketing commission > 0 or commissionTotal > 0
    const source = ledgers.find(l => {
      try { return l.detail && l.detail.marketing && Number(l.detail.marketing.commission) > 0; } catch (e) { return false; }
    }) || ledgers.find(l => Number(l.commissionTotal) > 0);

    // Pick target = ledger with commissionTotal == 0 or earliest
    const target = ledgers.find(l => Number(l.commissionTotal) === 0) || ledgers[0];

    if (!source) { console.log('No source ledger with commission found.'); process.exit(0); }
    if (!target) { console.log('No target ledger found.'); process.exit(0); }

    if (source.id === target.id) { console.log('Source and target are same ledger; nothing to merge.'); process.exit(0); }

    console.log('Merging source', source.id, 'into target', target.id);

    // Extract marketing commission
    const marketingCommission = (source.detail && source.detail.marketing && Number(source.detail.marketing.commission)) || 0;

    const previousMarketingCommission = (target.detail && target.detail.marketing && Number(target.detail.marketing.commission)) || 0;

    const existingGross = Number(target.grossCommission || 0);
    const existingPenalties = Number(target.penalties || 0);
    const grossBeforeMarketing = Math.max(0, existingGross - previousMarketingCommission);
    const newGross = grossBeforeMarketing + marketingCommission;
    const newNet = newGross - existingPenalties;
    const newCommissionTotal = (Number(target.commissionTotal || 0) - previousMarketingCommission + marketingCommission);

    const nextDetail = Object.assign({}, (typeof target.detail === 'object' && target.detail) ? target.detail : {}, { marketing: { periodKey: period.key, totals: source.detail && source.detail.marketing ? source.detail.marketing.totals : { totalSales: 0 }, commission: marketingCommission, computedAt: new Date().toISOString() } });

    const updated = await prisma.commissionLedger.update({ where: { id: target.id }, data: { grossCommission: newGross.toFixed(2), netCommission: newNet.toFixed(2), commissionTotal: newCommissionTotal.toFixed(2), detail: nextDetail } });

    console.log('Updated target ledger:', { id: updated.id, grossCommission: updated.grossCommission, netCommission: updated.netCommission, commissionTotal: updated.commissionTotal });

  } catch (e) {
    console.error('Error merging ledgers:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
