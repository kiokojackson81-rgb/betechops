"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEarningsSummaryForUser = getEarningsSummaryForUser;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const commission_1 = require("./commission");
async function getEarningsSummaryForUser(opts) {
    const now = opts.asOf ?? new Date();
    const tradingPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    const periodKey = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
    const periodLabel = tradingPeriod.label;
    const { period, tiers, tradingPeriod: periodInfo } = await (0, commission_1.getOrCreateCommissionPeriod)(now);
    const start = periodInfo.startDate ?? periodInfo.start;
    const end = periodInfo.endDate ?? periodInfo.end;
    const snapshots = await prisma_1.prisma.profitSnapshot.findMany({
        where: {
            orderItem: {
                order: {
                    attendantId: opts.userId,
                    createdAt: { gte: start, lte: end },
                },
            },
        },
        select: {
            revenue: true,
            profit: true,
        },
    });
    let totalSales = 0;
    let totalProfit = 0;
    for (const row of snapshots) {
        totalSales += Number(row.revenue ?? 0);
        totalProfit += Number(row.profit ?? 0);
    }
    const reports = await prisma_1.prisma.dailyReport.findMany({
        where: { userId: opts.userId, date: { gte: start, lte: end } },
        select: {
            newProducts: true,
            productsEdited: true,
            copiesUploaded: true,
        },
    });
    let newProducts = 0;
    let editedProducts = 0;
    let copiedProducts = 0;
    for (const report of reports) {
        newProducts += report.newProducts ?? 0;
        editedProducts += report.productsEdited ?? 0;
        copiedProducts += report.copiesUploaded ?? 0;
    }
    const plan = await prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId: opts.userId } });
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({
        where: { attendantId: opts.userId, periodKey },
    });
    const sum = (filterFn) => adjustments.filter(filterFn).reduce((acc, a) => acc + (a.amount ?? 0), 0);
    const bonusTotal = sum((a) => a.adjustmentType === "BONUS");
    const commissionTopUpTotal = sum((a) => a.adjustmentType === "COMMISSION_TOPUP");
    const chamaTotal = sum((a) => a.adjustmentType === "CHAMA");
    const latenessTotal = sum((a) => a.adjustmentType === "LATENESS");
    const disciplineTotal = sum((a) => a.adjustmentType === "DISCIPLINE");
    const otherDeductionsTotal = sum((a) => a.adjustmentType === "OTHER");
    // For the attendant-facing earnings summary we use the default behaviour
    // (which applies the configured profit-fallback percent) so this endpoint
    // mirrors previous commission calculations.
    const salesCommission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers);
    const { newProductCommission, copiedCommission, editedCommission } = (0, commission_1.computeProductCommissions)({
        newProducts,
        copiedProducts,
        editedProducts,
    });
    const grossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;
    const totalEarnings = baseSalary + transportAllowance + grossCommission + bonusTotal;
    const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    return {
        periodKey,
        periodLabel,
        totalSales,
        totalProfit,
        totalNewProducts: newProducts,
        totalEditedProducts: editedProducts,
        totalCopiedProducts: copiedProducts,
        totalItems: 0,
        totalReceipts: 0,
        walkInsServed: 0,
        walkInsPurchased: 0,
        baseSalary,
        transportAllowance,
        salesCommission,
        newProductCommission,
        copiedCommission,
        editedCommission,
        grossCommission,
        batteryEarnings: 0,
        bonusTotal,
        commissionTopUpTotal,
        chamaTotal,
        latenessTotal,
        disciplineTotal,
        otherDeductionsTotal,
        totalEarnings,
        totalDeductions,
        netPay,
        ledger: null,
    };
}
