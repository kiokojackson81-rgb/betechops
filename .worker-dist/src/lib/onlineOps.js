"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPreferredCommissionLedger = findPreferredCommissionLedger;
exports.getMarketplaceAssignmentsForUser = getMarketplaceAssignmentsForUser;
exports.getOnlineQuickStats = getOnlineQuickStats;
exports.getOnlineEarningsSummary = getOnlineEarningsSummary;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const recomputeWeeklySummaries_1 = require("@/lib/jobs/recomputeWeeklySummaries");
const commissionCommon_1 = require("@/lib/commissionCommon");
const commission_1 = require("@/lib/commission");
const onlineCommission_1 = require("@/lib/onlineCommission");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const payrollPeriodKey_1 = require("@/lib/payrollPeriodKey");
const COMMISSION_PROGRESS_TARGET = 2000000;
const DIRECT_SALES_TIER_THRESHOLD = 500000;
async function findPreferredCommissionLedger(userId, period) {
    const windowMs = 24 * 60 * 60 * 1000;
    const exact = await prisma_1.prisma.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
        select: {
            id: true,
            grossCommission: true,
            netCommission: true,
            penalties: true,
            commissionTotal: true,
            detail: true,
            createdAt: true,
        },
    });
    if (exact)
        return exact;
    const nearPositive = await prisma_1.prisma.commissionLedger.findFirst({
        where: {
            userId,
            periodStart: {
                gte: new Date(period.start.getTime() - windowMs),
                lte: new Date(period.start.getTime() + windowMs),
            },
            commissionTotal: { gt: 0 },
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            grossCommission: true,
            netCommission: true,
            penalties: true,
            commissionTotal: true,
            detail: true,
            createdAt: true,
        },
    });
    if (nearPositive)
        return nearPositive;
    const near = await prisma_1.prisma.commissionLedger.findFirst({
        where: {
            userId,
            periodStart: {
                gte: new Date(period.start.getTime() - windowMs),
                lte: new Date(period.start.getTime() + windowMs),
            },
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            grossCommission: true,
            netCommission: true,
            penalties: true,
            commissionTotal: true,
            detail: true,
            createdAt: true,
        },
    });
    return near;
}
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
    const [directStats, payoutWeeks, onlineOrdersCount, earnings, weeklyManual, commissionConfig] = await Promise.all([
        getDirectSalesStats(attendantId, period),
        accountIds.length
            ? (async () => {
                const aggs = await (0, recomputeWeeklySummaries_1.recomputeWeeklySummary)(period.start, period.end);
                return aggs.filter((a) => accountIds.includes(a.accountId));
            })()
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
        getWeeklyManualSales(attendantId, period),
        (0, commission_1.getOrCreateCommissionPeriod)(period.start),
    ]);
    const ledger = await findPreferredCommissionLedger(attendantId, period);
    const payoutSales = payoutWeeks.reduce((sum, w) => sum + Number(w.totalGross ?? 0), 0);
    const weeklyManualSales = weeklyManual.totalSales;
    const marketplaceSales = payoutSales + weeklyManualSales;
    const totalTrackedSales = directStats.sales + marketplaceSales;
    const tiers = commissionConfig?.tiers ?? [];
    let nextTierThreshold = COMMISSION_PROGRESS_TARGET;
    if (tiers.length) {
        const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
        const upcomingTier = sorted.find((tier) => totalTrackedSales < tier.minSales);
        if (upcomingTier) {
            nextTierThreshold = upcomingTier.minSales;
        }
        else {
            const lastTier = sorted[sorted.length - 1];
            nextTierThreshold = lastTier.maxSales ?? lastTier.minSales;
            if (totalTrackedSales > nextTierThreshold) {
                nextTierThreshold = totalTrackedSales;
            }
        }
    }
    const remainingToNextTier = Math.max(0, nextTierThreshold - totalTrackedSales);
    // Prefer authoritative `earnings.commissionTotal` first (set by getOnlineEarningsSummary),
    // otherwise fall back to a persisted ledger value, or finally the computed earnings.grossCommission.
    const earningsCommission = Number(earnings.commissionTotal ?? 0);
    const ledgerCommission = ledger ? Number(ledger.commissionTotal ?? ledger.netCommission ?? ledger.grossCommission ?? 0) : 0;
    const commissionKesValue = earningsCommission > 0 ? earningsCommission : ledgerCommission > 0 ? ledgerCommission : earnings.grossCommission;
    const commissionSource = earningsCommission > 0
        ? "earnings"
        : ledgerCommission > 0
            ? ledger?.id
                ? `ledger ${ledger.id}`
                : "ledger"
            : "computed";
    console.info(`[onlineQuickStats] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSource} value=${commissionKesValue.toFixed(2)}`);
    return {
        periodKey: period.key,
        periodLabel: period.label,
        receipts: directStats.receipts + weeklyManual.entries,
        salesKes: totalTrackedSales,
        commissionKes: commissionKesValue,
        commissionSource,
        itemsSold: directStats.items + onlineOrdersCount + weeklyManual.entries,
        directSales: directStats.sales,
        marketplaceSales,
        progressTarget: nextTierThreshold || COMMISSION_PROGRESS_TARGET,
        nextTierThreshold: nextTierThreshold || COMMISSION_PROGRESS_TARGET,
        remainingToNextTier,
    };
}
async function getOnlineEarningsSummary(attendantId, opts) {
    const period = opts?.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const { accountIds, roles } = await getMarketplaceAssignmentsForUser(attendantId);
    const [directStats, payoutWeeks, plan, adjustments, returns, weeklyManual, user] = await Promise.all([
        getDirectSalesStats(attendantId, period),
        accountIds.length
            ? (async () => {
                const aggs = await (0, recomputeWeeklySummaries_1.recomputeWeeklySummary)(period.start, period.end);
                return aggs.filter((a) => accountIds.includes(a.accountId));
            })()
            : Promise.resolve([]),
        prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId } }),
        prisma_1.prisma.attendantPayrollAdjustment.findMany({
            where: { attendantId, periodKey: { in: (0, payrollPeriodKey_1.getPeriodKeyVariantsFromDates)(period.start, period.end) } },
        }),
        prisma_1.prisma.marketplaceReturn.findMany({
            where: {
                attendantId,
                status: "CHARGED_TO_ATTENDANT",
                dueAt: { gte: period.start, lte: period.end },
            },
        }),
        getWeeklyManualSales(attendantId, period),
        prisma_1.prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } }),
    ]);
    const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.totalGross ?? 0), 0);
    const weeklyManualSales = weeklyManual.totalSales;
    const combinedDirectSales = directStats.sales + weeklyManualSales;
    const combinedDirectProfit = directStats.profit;
    const marketplaceCommission = (0, commissionCommon_1.calculateCumulativeCommission)(Math.max(0, marketplaceSales)).commission;
    const isSupervisor = roles.includes("SUPERVISOR");
    const supervisorBonus = isSupervisor ? computeSupervisorBonus(marketplaceSales) : 0;
    const returnsDeduction = returns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);
    const summed = sumAdjustments(adjustments);
    const isBrendah = (user?.email ?? "").toLowerCase() === "brendah@betech.co.ke";
    let directSalesCommission;
    let brendahComputedCommission = null;
    let brendahMergedSales = 0;
    let brendahMergedProfit = 0;
    if (isBrendah) {
        const marketingSummary = await (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId: attendantId, period });
        const supportSummary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: attendantId, period });
        const marketingPer = (marketingSummary?.perReceipts ?? {});
        const supportPer = (supportSummary?.perReceipts ?? {});
        const merged = new Map();
        const normalize = (entry) => ({
            sales: Number(entry.sales ?? 0),
            profit: Number(entry.profit ?? 0),
            items: Number(entry.items ?? 0),
        });
        for (const [key, value] of Object.entries(marketingPer)) {
            merged.set(key, normalize(value));
        }
        for (const [key, value] of Object.entries(supportPer)) {
            const normalized = normalize(value);
            if (merged.has(key)) {
                const existing = merged.get(key);
                if ((existing.profit ?? 0) <= 0 && normalized.profit > 0) {
                    merged.set(key, normalized);
                }
                continue;
            }
            merged.set(key, normalized);
        }
        for (const entry of merged.values()) {
            if ((entry.profit ?? 0) <= 0)
                continue;
            brendahMergedSales += entry.sales;
            brendahMergedProfit += entry.profit;
        }
        const direct = (0, onlineCommission_1.computeDirectCommission)(brendahMergedSales, brendahMergedProfit);
        directSalesCommission = direct.amount;
        const marketingTotals = (marketingSummary && marketingSummary.totals) || {};
        const { newProductCommission, copiedCommission, editedCommission } = (0, commission_1.computeProductCommissions)({
            newProducts: marketingTotals.totalNewProducts ?? 0,
            copiedProducts: marketingTotals.totalCopiedProducts ?? 0,
            editedProducts: marketingTotals.totalEditedProducts ?? 0,
        });
        const productCommissionTotal = newProductCommission + copiedCommission + editedCommission;
        brendahComputedCommission = direct.amount + productCommissionTotal + summed.commissionTopUpTotal;
    }
    else {
        directSalesCommission =
            combinedDirectSales < DIRECT_SALES_TIER_THRESHOLD
                ? Math.max(0, Math.round(combinedDirectProfit * 0.05))
                : (0, commissionCommon_1.calculateCumulativeCommission)(Math.max(0, combinedDirectSales)).commission;
    }
    const grossCommission = directSalesCommission + marketplaceCommission + supervisorBonus - returnsDeduction;
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    const totalEarnings = baseSalary + transportAllowance + grossCommission + summed.bonusTotal + summed.commissionTopUpTotal;
    const totalDeductions = summed.chamaTotal + summed.latenessTotal + summed.disciplineTotal + summed.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    // Prefer persisted CommissionLedger `commissionTotal` when present for this period.
    const ledger = await findPreferredCommissionLedger(attendantId, period);
    const ledgerCommissionValue = ledger ? Number(ledger.commissionTotal ?? 0) : 0;
    let commissionTotal;
    let commissionSourceLabel;
    if (ledgerCommissionValue > 0) {
        commissionTotal = ledgerCommissionValue;
        commissionSourceLabel = `ledger${ledger?.id ? ` (${ledger.id})` : ""}`;
    }
    else if (isBrendah && brendahComputedCommission != null) {
        commissionTotal = brendahComputedCommission;
        commissionSourceLabel = "computed-brendah";
    }
    else {
        commissionTotal = grossCommission;
        commissionSourceLabel = "computed-gross";
    }
    const brendahDebug = isBrendah ? ` dedupSales=${brendahMergedSales} dedupProfit=${brendahMergedProfit}` : "";
    console.info(`[onlineEarningsSummary] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSourceLabel} total=${commissionTotal.toFixed(2)}${brendahDebug}`);
    return {
        periodKey: period.key,
        periodLabel: period.label,
        directSales: combinedDirectSales,
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
        commissionTotal,
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
async function getWeeklyManualSales(attendantId, period) {
    const summary = await prisma_1.prisma.weeklySale.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: {
            userId: attendantId,
            status: client_1.WeeklySaleStatus.APPROVED,
            AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
        },
    });
    const entries = typeof summary._count === "number" ? summary._count : summary._count?._all ?? 0;
    return {
        totalSales: Number(summary._sum?.amount ?? 0),
        entries,
    };
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
