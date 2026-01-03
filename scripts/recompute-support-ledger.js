const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMMISSION_LADDER = [
  { min: 1000000, reward: 10000 },
  { min: 2000000, reward: 15000 },
  { min: 3000000, reward: 20000 },
  { min: 4000000, reward: 20000 },
  { min: 5000000, reward: 20000 },
  { min: 6000000, reward: 20000 },
  { min: 7000000, reward: 20000 },
  { min: 8000000, reward: 20000 },
  { min: 9000000, reward: 20000 },
  { min: 10000000, reward: 20000 },
];

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month+1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month-1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0,0,0,0);
  const end = new Date(endYear, endMonth, 24, 23,59,59,999);
  return { start, end };
}

function calculateTierCommission(totalSales) {
  const tiersReached = COMMISSION_LADDER.filter(t => t.min <= totalSales);
  return tiersReached.reduce((s, t) => s + t.reward, 0);
}

(async () => {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node recompute-support-ledger.js <userId>');
    process.exit(2);
  }
  const period = getTradingPeriodFor(new Date());
  console.log('Recomputing support ledger for', userId, 'period', period.start.toISOString(), '-', period.end.toISOString());
  try {
    const entries = await prisma.supportDailyEntry.findMany({ where: { submittedById: userId, date: { gte: period.start, lte: period.end } }, include: { receipts: true, sales: true } });
    const backed = entries.filter(e => (Array.isArray(e.receipts) && e.receipts.length > 0) || (Array.isArray(e.sales) && e.sales.length > 0));
    if (backed.length === 0) {
      console.log('No backed support entries found; clearing support commission in ledger if present');
      const existing = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } } });
      if (existing) {
        // remove support portion from commissionTotal and grossCommission
        const detail = existing.detail || {};
        const prevSupport = detail.support?.commission ?? 0;
        const newCommissionTotal = Number(existing.commissionTotal ?? 0) - Number(prevSupport ?? 0);
        const newGross = Math.max(0, Number(existing.grossCommission ?? 0) - Number(prevSupport ?? 0));
        await prisma.commissionLedger.update({ where: { id: existing.id }, data: { commissionTotal: newCommissionTotal.toFixed(2), grossCommission: newGross.toFixed(2), netCommission: newGross.toFixed(2), detail: { ...(detail || {}), support: null, supportCommission: 0 } } });
        console.log('Cleared support commission from ledger', existing.id);
      } else {
        console.log('No existing ledger to clear');
      }
      return;
    }

    // compute totals from backed entries
    let totalSales = 0;
    let totalProfit = 0;
    let totalReceipts = 0;
    for (const e of backed) {
      totalSales += Number(e.totalSales ?? 0);
      totalProfit += Number(e.totalProfit ?? 0);
      if (Array.isArray(e.receipts)) totalReceipts += e.receipts.length;
      if (Array.isArray(e.sales)) totalReceipts += e.sales.length;
    }

    const fallbackCommission = Math.max(0, Math.round(totalProfit * 0.05));
    const tierCommission = calculateTierCommission(totalSales);
    const supportCommission = fallbackCommission + tierCommission;

    // Guard: compute marketing profit for the same period and avoid creating
    // support-ledger when support profit is implausibly larger than marketing
    // profit (e.g., > 2x). This mirrors the server-side guard and prevents
    // accidental fallback ledger creation from this script.
    try {
      const marketingEntries = await prisma.marketingDailyEntry.findMany({
        where: { submittedById: userId, date: { gte: period.start, lte: period.end } },
        include: { receipts: { include: { items: true } }, sales: true },
      });

      let marketingProfit = 0;
      if (Array.isArray(marketingEntries) && marketingEntries.length > 0) {
        for (const me of marketingEntries) {
          if (Array.isArray(me.receipts) && me.receipts.length > 0) {
            for (const r of me.receipts) {
              const selling = Number(r.sellingTotal ?? 0);
              const aggregateCost = Number(r.buyingTotal ?? 0);
              if (aggregateCost > 0) {
                marketingProfit += selling - aggregateCost;
              } else if (Array.isArray(r.items) && r.items.length > 0) {
                const itemCost = r.items.reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
                marketingProfit += selling - itemCost;
              }
            }
          } else if (Array.isArray(me.sales) && me.sales.length > 0) {
            for (const s of me.sales) {
              const selling = Number(s.sellingPrice ?? 0);
              const buying = Number(s.buyingPrice ?? 0);
              if (buying > 0) marketingProfit += selling - buying;
            }
          } else {
            marketingProfit += Number(me.totalProfit ?? 0);
          }
        }
      }

      if (marketingProfit > 0 && totalProfit > marketingProfit * 2) {
        console.log('Support profit implausibly large compared to marketing profit; aborting ledger upsert');
        return;
      }
    } catch (err) {
      // best-effort guard; continue if check fails
    }

    // upsert ledger support values
    const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } } });
    // If an existing ledger already has marketing-derived commission, avoid
    // letting support recompute overwrite it.
    const detailValueCheck = existingLedger?.detail ?? {};
    const existingMarketingComm = detailValueCheck && detailValueCheck.marketing ? Number(detailValueCheck.marketing.commission ?? 0) : 0;
    if (existingMarketingComm > 0) {
      console.log('Existing marketing commission present; skipping support-ledger upsert');
      return;
    }
    const detailValue = existingLedger?.detail ?? {};
    const previousSupportCommission = (detailValue && detailValue.support && typeof detailValue.support.commission === 'number') ? detailValue.support.commission : Number(detailValue.supportCommission ?? 0);

    const grossBeforeSupport = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousSupportCommission ?? 0));
    const grossCommission = grossBeforeSupport + supportCommission;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;

    const nextDetail = { ...(detailValue || {}), support: { periodKey: `${period.start.toISOString().split('T')[0]}_${period.end.toISOString().split('T')[0]}`, totals: { totalSales, totalProfit, totalReceipts }, commission: supportCommission, computedAt: new Date().toISOString() }, supportCommission };

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } },
      update: {
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - Number(previousSupportCommission ?? 0) + supportCommission).toFixed(2),
        detail: nextDetail,
      },
      create: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: supportCommission.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Upserted ledger:', upsert.id, 'supportCommission:', supportCommission);
  } catch (e) {
    console.error('Recompute failed:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
