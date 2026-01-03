#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
(async function registerAndRun(){
  try{
    const projectRoot = path.resolve(__dirname,'..');
    require('ts-node').register({ transpileOnly: true, project: path.join(projectRoot,'tsconfig.json'), compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
    const tsconfigPath = path.join(projectRoot,'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath,'utf8'));
    require('tsconfig-paths').register({ baseUrl: projectRoot, paths: (tsconfig.compilerOptions&&tsconfig.compilerOptions.paths) || {} });

    const { getEarningsSummaryForUser } = require('../src/lib/earningsSummary.ts');
    const { summarizeMarketingReportsForPeriod } = require('../src/lib/marketingPeriodTotals.ts');
    const { getSupportPeriodAggregates } = require('../src/lib/supportEntries.ts');
    const { getTradingPeriodFor } = require('../src/lib/tradingPeriod.ts');
    const { prisma } = require('../src/lib/prisma.ts');

    const emailOrId = process.argv[2] || 'brendah@betech.co.ke';
    // Resolve user id: try to find user by email, else assume it's a userId
    let user = await prisma.user.findUnique({ where: { email: String(emailOrId).toLowerCase() } });
    let userId = user ? user.id : emailOrId;

    const now = new Date();
    const period = getTradingPeriodFor(now);

    const [summary, marketingSummary, supportSummary, ledger] = await Promise.all([
      getEarningsSummaryForUser({ userId }),
      summarizeMarketingReportsForPeriod({ userId, period }),
      getSupportPeriodAggregates({ userId, period }),
      prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } } }),
    ]);

    // merge per-receipts like the route
    const marketingPer = (marketingSummary && marketingSummary.perReceipts) || {};
    const supportPer = (supportSummary && supportSummary.perReceipts) || {};
    const merged = new Map();
    for (const [k, v] of Object.entries(marketingPer)) merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    for (const [k, v] of Object.entries(supportPer)) { if (!merged.has(k)) merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 }); }

    let combinedSales = 0, combinedProfit = 0, combinedItems = 0, combinedReceipts = 0;
    const combinedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
    for (const [, v] of merged) {
      combinedSales += v.sales; combinedProfit += v.profit; combinedItems += v.items || 0;
      combinedPaymentStats.totalSalesMpesa += v.mpesa || 0; combinedPaymentStats.totalSalesCash += v.cash || 0;
      if (v.mpesa > 0) combinedPaymentStats.countMpesaReceipts += 1;
      if (v.cash > 0) combinedPaymentStats.countCashReceipts += 1;
    }
    combinedReceipts = merged.size;

    const detail = ledger && ledger.detail ? ledger.detail : undefined;
    const marketingCommission = detail && typeof detail === 'object' ? Number(detail.marketing?.commission ?? 0) : 0;
    const supportCommission = detail && typeof detail === 'object' ? Number(detail.support?.commission ?? 0) : 0;

    let salesCommission = marketingCommission + supportCommission;
    if (salesCommission === 0 && ledger) salesCommission = Number(ledger.grossCommission ?? 0);
    if (salesCommission === 0) salesCommission = summary.salesCommission;

    const grossCommission = salesCommission + summary.newProductCommission + summary.copiedCommission + summary.editedCommission + summary.commissionTopUpTotal;

    const payload = {
      perReceiptCanonicalKeys: Array.from(merged.keys()),
      ...summary,
      totalSales: combinedSales,
      totalProfit: combinedProfit,
      totalNewProducts: marketingSummary.totals.totalNewProducts,
      totalEditedProducts: marketingSummary.totals.totalEditedProducts,
      totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
      salesCommission,
      grossCommission,
      totalEarnings: summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal,
      totalDeductions: summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal,
      netPay: summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal - (summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal),
      totalItems: combinedItems,
      totalReceipts: combinedReceipts,
      walkInsServed: marketingSummary.totals.walkInsServed,
      walkInsPurchased: marketingSummary.totals.walkInsPurchased,
      ledger: ledger ? { grossCommission: Number(ledger.grossCommission), netCommission: Number(ledger.netCommission), penalties: Number(ledger.penalties), detail: ledger.detail } : null,
    };

    console.log(JSON.stringify(payload, null, 2));
  }catch(e){
    console.error('ERR', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();
