"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const auth_1 = require("@/lib/auth");
const supportEntries_1 = require("@/lib/supportEntries");
const marketingCommission_1 = require("@/lib/marketingCommission");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["SUPPORT_OPS", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const periodKey = period.key;
    const [{ aggregates }, compPlan, adjustments, ledger] = await Promise.all([
        (0, supportEntries_1.getSupportPeriodAggregates)({ userId: auth.user.id, period }),
        prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId: auth.user.id } }),
        prisma_1.prisma.attendantPayrollAdjustment.findMany({
            where: { attendantId: auth.user.id, periodKey },
        }),
        prisma_1.prisma.commissionLedger.findUnique({
            where: {
                userId_periodStart_periodEnd: {
                    userId: auth.user.id,
                    periodStart: period.start,
                    periodEnd: period.end,
                },
            },
        }),
    ]);
    const periodSales = aggregates.totalSales;
    const periodProfit = aggregates.totalProfit;
    const totalBatteries = aggregates.newBatteries + aggregates.changedBatteries;
    const batteryEarnings = totalBatteries * 70;
    const detail = ledger?.detail;
    const supportDetail = detail && typeof detail === "object" ? detail.support : undefined;
    let salesCommission = null;
    if (supportDetail && typeof supportDetail.commission === "number") {
        salesCommission = supportDetail.commission;
    }
    else if (ledger && typeof ledger.grossCommission === "object") {
        salesCommission = Number(ledger.grossCommission) || 0;
    }
    if (salesCommission === null) {
        const fallbackCommission = Math.max(0, Math.round(periodProfit * 0.05));
        const tierCommission = (0, marketingCommission_1.getCommissionSummaryForSales)(periodSales).commission ?? 0;
        salesCommission = fallbackCommission + tierCommission;
    }
    const baseSalary = compPlan?.baseSalary ?? 0;
    const transportAllowance = compPlan?.defaultTransportAllowance ?? 0;
    const sumByType = (types) => adjustments
        .filter((adj) => types.includes(adj.adjustmentType))
        .reduce((sum, adj) => sum + (adj.amount ?? 0), 0);
    const bonusTotal = sumByType(["BONUS"]);
    const commissionTopUpTotal = sumByType(["COMMISSION_TOPUP"]);
    const chamaTotal = sumByType(["CHAMA"]);
    const latenessTotal = sumByType(["LATENESS"]);
    const disciplineTotal = sumByType(["DISCIPLINE"]);
    const otherDeductionsTotal = sumByType(["OTHER"]);
    const totalEarnings = baseSalary +
        transportAllowance +
        salesCommission +
        batteryEarnings +
        bonusTotal +
        commissionTopUpTotal;
    const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    return server_1.NextResponse.json({
        periodKey,
        periodLabel: period.label,
        totalSales: periodSales,
        totalProfit: periodProfit,
        totalNewProducts: 0,
        totalEditedProducts: 0,
        totalCopiedProducts: 0,
        baseSalary,
        transportAllowance,
        salesCommission,
        newProductCommission: 0,
        copiedCommission: 0,
        editedCommission: 0,
        grossCommission: salesCommission + batteryEarnings + commissionTopUpTotal,
        bonusTotal,
        commissionTopUpTotal,
        chamaTotal,
        latenessTotal,
        disciplineTotal,
        otherDeductionsTotal,
        totalEarnings,
        totalDeductions,
        netPay,
        batteryEarnings,
    });
}
