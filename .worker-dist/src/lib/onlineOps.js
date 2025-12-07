"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceAssignmentsForUser = getMarketplaceAssignmentsForUser;
exports.getOnlineQuickStats = getOnlineQuickStats;
exports.getOnlineEarningsSummary = getOnlineEarningsSummary;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const commissionCommon_1 = require("@/lib/commissionCommon");
const COMMISSION_PROGRESS_TARGET = 1000000;
const DIRECT_SALES_TIER_THRESHOLD = 500000;
async function getMarketplaceAssignmentsForUser(attendantId) {
    const now = new Date();
    const assignments = await prisma_1.prisma.marketplaceAccountAssignment.findMany({
        where: {
            attendantId,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        orderBy: [{ createdAt: "asc" }],
        include: { account: true },
    });
    return {
        assignments,
        accountIds: assignments.map((a) => a.accountId),
        roles: assignments.map((a) => a.role),
    };
}
async function getOnlineQuickStats(attendantId, opts) {
    const period = opts?.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const { accountIds } = await getMarketplaceAssignmentsForUser(attendantId);
    const [directStats, payoutWeeks, onlineOrdersCount, earnings] = await Promise.all([
        getDirectSalesStats(attendantId, period),
        accountIds.length
            ? prisma_1.prisma.marketplacePayoutWeek.findMany({
                where: {
                    accountId: { in: accountIds },
                    weekEnd: { gte: period.start, lte: period.end },
                },
            })
            : Promise.resolve([]),
        accountIds.length
            ? prisma_1.prisma.marketplaceOrder.count({
                where: {
                    accountId: { in: accountIds },
                    orderedAt: { gte: period.start, lte: period.end },
                },
            })
            : Promise.resolve(0),
        getOnlineEarningsSummary(attendantId, { period }),
    ]);
    const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
    return {
        periodKey: period.key,
        periodLabel: period.label,
        receipts: directStats.receipts,
        salesKes: directStats.sales + marketplaceSales,
        commissionKes: earnings.grossCommission,
        itemsSold: directStats.items + onlineOrdersCount,
        directSales: directStats.sales,
        marketplaceSales,
        progressTarget: COMMISSION_PROGRESS_TARGET,
    };
}
async function getOnlineEarningsSummary(attendantId, opts) {
    const period = opts?.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const { accountIds, roles } = await getMarketplaceAssignmentsForUser(attendantId);
    const [directStats, payoutWeeks, plan, adjustments, returns] = await Promise.all([
        getDirectSalesStats(attendantId, period),
        accountIds.length
            ? prisma_1.prisma.marketplacePayoutWeek.findMany({
                where: {
                    accountId: { in: accountIds },
                    weekEnd: { gte: period.start, lte: period.end },
                },
            })
            : Promise.resolve([]),
        prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId } }),
        prisma_1.prisma.attendantPayrollAdjustment.findMany({
            where: { attendantId, periodKey: period.key },
        }),
        prisma_1.prisma.marketplaceReturn.findMany({
            where: {
                attendantId,
                status: "CHARGED_TO_ATTENDANT",
                dueAt: { gte: period.start, lte: period.end },
            },
        }),
    ]);
    const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
    const directSalesCommission = directStats.sales < DIRECT_SALES_TIER_THRESHOLD
        ? Math.max(0, Math.round(directStats.profit * 0.05))
        : (0, commissionCommon_1.calculateCumulativeCommission)(Math.max(0, directStats.profit)).commission;
    const marketplaceCommission = (0, commissionCommon_1.calculateCumulativeCommission)(Math.max(0, marketplaceSales)).commission;
    const isSupervisor = roles.includes("SUPERVISOR");
    const supervisorBonus = isSupervisor ? computeSupervisorBonus(marketplaceSales) : 0;
    const returnsDeduction = returns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);
    const grossCommission = directSalesCommission + marketplaceCommission + supervisorBonus - returnsDeduction;
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    const summed = sumAdjustments(adjustments);
    const totalEarnings = baseSalary + transportAllowance + grossCommission + summed.bonusTotal + summed.commissionTopUpTotal;
    const totalDeductions = summed.chamaTotal + summed.latenessTotal + summed.disciplineTotal + summed.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    return {
        periodKey: period.key,
        periodLabel: period.label,
        directSales: directStats.sales,
        directProfit: directStats.profit,
        marketplaceSales,
        directCommission: directSalesCommission,
        marketplaceCommission,
        supervisorBonus,
        returnsDeduction,
        grossCommission,
        baseSalary,
        transportAllowance,
        bonusTotal: summed.bonusTotal,
        commissionTopUpTotal: summed.commissionTopUpTotal,
        chamaTotal: summed.chamaTotal,
        latenessTotal: summed.latenessTotal,
        disciplineTotal: summed.disciplineTotal,
        otherDeductionsTotal: summed.otherDeductionsTotal,
        totalEarnings,
        totalDeductions,
        netPay,
    };
}
async function getDirectSalesStats(attendantId, period) {
    const entries = await prisma_1.prisma.supportDailyEntry.findMany({
        where: {
            submittedById: attendantId,
            date: { gte: period.start, lte: period.end },
        },
        select: {
            totalSales: true,
            totalProfit: true,
            receipts: {
                select: {
                    items: { select: { id: true } },
                },
            },
        },
    });
    return entries.reduce((acc, entry) => {
        acc.sales += entry.totalSales;
        acc.profit += entry.totalProfit;
        acc.receipts += entry.receipts.length;
        acc.items += entry.receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
        return acc;
    }, { sales: 0, profit: 0, receipts: 0, items: 0 });
}
function sumAdjustments(adjustments) {
    const sum = (types) => adjustments
        .filter((a) => types.includes(a.adjustmentType))
        .reduce((acc, a) => acc + (a.amount ?? 0), 0);
    return {
        bonusTotal: sum(["BONUS"]),
        commissionTopUpTotal: sum(["COMMISSION_TOPUP"]),
        chamaTotal: sum(["CHAMA"]),
        latenessTotal: sum(["LATENESS"]),
        disciplineTotal: sum(["DISCIPLINE"]),
        otherDeductionsTotal: sum(["OTHER"]),
    };
}
function computeSupervisorBonus(totalSales) {
    if (totalSales < 10000000)
        return 0;
    const millions = Math.floor(totalSales / 1000000);
    const over = Math.max(0, millions - 9);
    return over * 10000;
}
