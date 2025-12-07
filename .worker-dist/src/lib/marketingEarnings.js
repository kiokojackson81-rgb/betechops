"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEarningsSummaryForAttendant = getEarningsSummaryForAttendant;
const prisma_1 = require("@/lib/prisma");
const commission_1 = require("@/lib/commission");
const marketingReport_1 = require("./marketingReport");
const supportEntries_1 = require("./supportEntries");
const tradingPeriod_1 = require("./tradingPeriod");
async function getEarningsSummaryForAttendant(opts) {
    const { attendantId, periodKey, periodLabel } = opts;
    // 1) Fetch total sales for this attendant + period via existing report helper
    const report = await (0, marketingReport_1.getMarketingReport)({ tradingPeriodKey: periodKey, submittedById: attendantId });
    const marketingSales = report?.aggregates?.totalSales ?? 0;
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
    const supportSummary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: attendantId, period });
    const supportSales = supportSummary?.aggregates?.totalSales ?? 0;
    const sales = marketingSales + supportSales;
    // 2) Commission: only award commission once the attendant crosses the
    //    minimum ladder target (KES 1,000,000). Before that no commission
    //    should appear in any earnings summary.
    const { tiers } = (await (0, commission_1.getOrCreateCommissionPeriod)(new Date()));
    const marketingProfit = report?.aggregates?.totalProfit ?? 0;
    const supportProfit = supportSummary?.aggregates?.totalProfit ?? 0;
    const periodProfit = marketingProfit + supportProfit;
    const MIN_SALES_FOR_COMMISSION = 1000000;
    const rawCommission = (0, commission_1.computeSalesCommissionFromTiers)(sales, periodProfit, tiers);
    const commission = sales >= MIN_SALES_FOR_COMMISSION ? rawCommission : 0;
    // 3) Comp plan (if none, treat as zeros)
    const plan = await prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId } });
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    // 4) All adjustments for this period
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({ where: { attendantId, periodKey } });
    const sum = (filterFn) => adjustments.filter(filterFn).reduce((acc, a) => acc + (a.amount ?? 0), 0);
    const bonusTotal = sum((a) => a.adjustmentType === "BONUS" || a.adjustmentType === "COMMISSION_TOPUP");
    const chamaTotal = sum((a) => a.adjustmentType === "CHAMA");
    const latenessTotal = sum((a) => a.adjustmentType === "LATENESS");
    const disciplineTotal = sum((a) => a.adjustmentType === "DISCIPLINE");
    const otherDeductionsTotal = sum((a) => a.adjustmentType === "OTHER");
    const totalEarnings = baseSalary + transportAllowance + commission + bonusTotal;
    const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
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
    };
}
