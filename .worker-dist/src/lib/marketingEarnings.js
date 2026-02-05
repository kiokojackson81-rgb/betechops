"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEarningsSummaryForAttendant = getEarningsSummaryForAttendant;
const prisma_1 = require("@/lib/prisma");
const commission_1 = require("@/lib/commission");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("./supportEntries");
const tradingPeriod_1 = require("./tradingPeriod");
const payrollPeriodKey_1 = require("./payrollPeriodKey");
async function getEarningsSummaryForAttendant(opts) {
    const { attendantId, periodKey, periodLabel } = opts;
    // 1) Determine trading period (prefer caller's periodKey) and then fetch total sales
    // 1b) Include support sales for this attendant in the same period so commission
    // reflects both marketing and support priced items. Prefer the periodKey
    // passed from the caller; fall back to the current trading period.
    let period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    if (periodKey) {
        const recent = (0, tradingPeriod_1.getRecentTradingPeriods)(24);
        const found = recent.find((p) => p.key === periodKey);
        if (found)
            period = found;
    }
    const tradingPeriod = period;
    const marketingSummary = await (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId: attendantId, period: tradingPeriod });
    const marketingSales = marketingSummary?.totals?.totalSales ?? 0;
    const supportSummary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: attendantId, period });
    // Merge per-receipt maps to avoid double-counting
    const marketingPer = marketingSummary?.perReceipts ?? {};
    const supportPer = supportSummary?.perReceipts ?? {};
    const merged = new Map();
    for (const [k, v] of Object.entries(marketingPer)) {
        merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0 });
    }
    for (const [k, v] of Object.entries(supportPer)) {
        const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0 };
        if (merged.has(k)) {
            const existing = merged.get(k);
            if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
                merged.set(k, supportObj);
            }
            continue;
        }
        merged.set(k, supportObj);
    }
    let sales = 0;
    for (const [, v] of merged)
        sales += v.sales;
    // 2) Commission: only award commission once the attendant crosses the
    //    minimum ladder target (KES 1,000,000). Before that no commission
    //    should appear in any earnings summary.
    const { tiers } = (await (0, commission_1.getOrCreateCommissionPeriod)(new Date()));
    const marketingProfit = marketingSummary?.totals?.totalProfit ?? 0;
    const supportProfit = supportSummary?.aggregates?.totalProfit ?? 0;
    let periodProfit = marketingProfit + supportProfit;
    // if merged has per-receipt profit, prefer merged profit
    let mergedProfit = 0;
    for (const [, v] of merged)
        mergedProfit += v.profit;
    if (mergedProfit > 0)
        periodProfit = mergedProfit;
    const MIN_SALES_FOR_COMMISSION = 1000000;
    const rawCommission = (0, commission_1.computeSalesCommissionFromTiers)(sales, periodProfit, tiers);
    const commission = sales >= MIN_SALES_FOR_COMMISSION ? rawCommission : 0;
    // 3) Comp plan (if none, treat as zeros)
    const plan = await prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId } });
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    // 4) All adjustments for this period
    const variants = (0, payrollPeriodKey_1.getPeriodKeyVariants)(periodKey);
    const adjustmentFilterKeys = variants.length ? variants : [periodKey];
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({
        where: { attendantId, periodKey: { in: adjustmentFilterKeys } },
    });
    const sum = (filterFn) => adjustments.filter(filterFn).reduce((acc, a) => acc + (a.amount ?? 0), 0);
    const bonusTotal = sum((a) => a.adjustmentType === "BONUS" || a.adjustmentType === "COMMISSION_TOPUP");
    const chamaTotal = sum((a) => a.adjustmentType === "CHAMA");
    const latenessTotal = sum((a) => a.adjustmentType === "LATENESS");
    const disciplineTotal = sum((a) => a.adjustmentType === "DISCIPLINE");
    const otherDeductionsTotal = sum((a) => a.adjustmentType === "OTHER");
    const totalEarnings = baseSalary + transportAllowance + commission + bonusTotal;
    const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    const adjustmentEntries = adjustments.map((a) => ({
        id: a.id,
        label: a.label,
        amount: a.amount ?? 0,
        adjustmentType: a.adjustmentType,
        adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
    }));
    return {
        periodKey,
        periodLabel,
        sales,
        baseSalary,
        transportAllowance,
        commission,
        bonusTotal,
        chamaTotal,
        latenessTotal,
        disciplineTotal,
        otherDeductionsTotal,
        totalEarnings,
        totalDeductions,
        netPay,
        adjustmentEntries,
    };
}
