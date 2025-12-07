"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const earningsSummary_1 = require("@/lib/earningsSummary");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const url = new URL(req.url);
    const impersonateId = url.searchParams.get("impersonateId");
    // `getServerSession` can return various session shapes depending on adapters.
    // Explicitly type as `any` so we can safely access `user` without TypeScript
    // complaining about missing properties in some environments.
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    const actorId = session?.user?.id;
    if (!actorId && !impersonateId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (impersonateId && session?.user?.role !== "ADMIN") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = impersonateId ?? actorId;
    if (!userId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = new Date();
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    const [summary, marketingSummary, supportSummary, ledger] = await Promise.all([
        (0, earningsSummary_1.getEarningsSummaryForUser)({ userId }),
        (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId, period }),
        (0, supportEntries_1.getSupportPeriodAggregates)({ userId, period }),
        prisma_1.prisma.commissionLedger.findUnique({
            where: {
                userId_periodStart_periodEnd: {
                    userId,
                    periodStart: period.start,
                    periodEnd: period.end,
                },
            },
        }),
    ]);
    const supportTotals = supportSummary?.aggregates ?? {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
    };
    const combinedSales = marketingSummary.totals.totalSales + supportTotals.totalSales;
    const combinedProfit = marketingSummary.totals.totalProfit + supportTotals.totalProfit;
    const combinedItems = marketingSummary.totals.totalItems + supportTotals.totalItems;
    const combinedReceipts = marketingSummary.totals.totalReceipts + supportTotals.totalReceipts;
    const detail = ledger?.detail;
    const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
    const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
    let salesCommission = marketingCommission + supportCommission;
    if (salesCommission === 0 && ledger) {
        salesCommission = Number(ledger.grossCommission ?? 0);
    }
    if (salesCommission === 0) {
        salesCommission = summary.salesCommission;
    }
    const grossCommission = salesCommission +
        summary.newProductCommission +
        summary.copiedCommission +
        summary.editedCommission +
        summary.commissionTopUpTotal;
    const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
    const totalDeductions = summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    return server_1.NextResponse.json({
        ...summary,
        totalSales: combinedSales,
        totalProfit: combinedProfit,
        totalNewProducts: marketingSummary.totals.totalNewProducts,
        totalEditedProducts: marketingSummary.totals.totalEditedProducts,
        totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
        salesCommission,
        grossCommission,
        totalEarnings,
        totalDeductions,
        netPay,
        totalItems: combinedItems,
        totalReceipts: combinedReceipts,
        walkInsServed: marketingSummary.totals.walkInsServed,
        walkInsPurchased: marketingSummary.totals.walkInsPurchased,
        ledger: ledger
            ? {
                grossCommission: Number(ledger.grossCommission),
                netCommission: Number(ledger.netCommission),
                penalties: Number(ledger.penalties),
                detail: ledger.detail,
            }
            : null,
    });
}
