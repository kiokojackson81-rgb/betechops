"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const earningsSummary_1 = require("@/lib/earningsSummary");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const prisma_1 = require("@/lib/prisma");
const commission_1 = require("@/lib/commission");
const resolveTargetUser_1 = require("@/lib/resolveTargetUser");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const identity = await (0, resolveTargetUser_1.resolveTargetUserId)(req, { allowedImpersonationRoles: ["ADMIN"] });
    const meta = identity;
    const userId = identity.resolvedUserId;
    if (!userId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = new Date();
    await (0, commission_1.getOrCreateCommissionPeriod)(now);
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
    // Merge per-receipt maps from marketing and support to avoid double-counting
    const marketingPer = marketingSummary?.perReceipts ?? {};
    const supportPer = supportSummary?.perReceipts ?? {};
    const merged = new Map();
    for (const [k, v] of Object.entries(marketingPer)) {
        merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    }
    for (const [k, v] of Object.entries(supportPer)) {
        const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
        if (merged.has(k)) {
            const existing = merged.get(k);
            if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
                merged.set(k, supportObj);
            }
            continue; // marketing wins otherwise
        }
        merged.set(k, supportObj);
    }
    let combinedSales = 0;
    let combinedProfit = 0;
    let combinedItems = 0;
    let combinedReceipts = 0;
    const combinedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
    for (const [, v] of merged) {
        combinedSales += v.sales;
        combinedProfit += v.profit;
        combinedItems += v.items;
        combinedPaymentStats.totalSalesMpesa += v.mpesa;
        combinedPaymentStats.totalSalesCash += v.cash;
        if (v.mpesa > 0)
            combinedPaymentStats.countMpesaReceipts += 1;
        if (v.cash > 0)
            combinedPaymentStats.countCashReceipts += 1;
    }
    combinedReceipts = merged.size;
    const detail = ledger?.detail;
    const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
    const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
    let salesCommission = marketingCommission + supportCommission;
    const ledgerPersisted = Number(ledger?.commissionTotal ?? ledger?.commission_total ?? 0);
    if (ledgerPersisted > 0) {
        salesCommission = ledgerPersisted;
    }
    else {
        if (salesCommission === 0 && ledger) {
            salesCommission = Number(ledger.grossCommission ?? 0);
        }
        if (salesCommission === 0) {
            salesCommission = summary.salesCommission;
        }
    }
    const grossCommission = ledgerPersisted > 0
        ? ledgerPersisted
        : salesCommission + summary.newProductCommission + summary.copiedCommission + summary.editedCommission + summary.commissionTopUpTotal;
    const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
    const totalDeductions = summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    const payload = {
        // expose canonical per-receipt keys for clients to dedupe local receipts
        perReceiptCanonicalKeys: Array.from(merged.keys()),
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
        commission: grossCommission,
        ledger: ledger
            ? {
                grossCommission: Number(ledger.grossCommission),
                netCommission: Number(ledger.netCommission),
                penalties: Number(ledger.penalties),
                detail: ledger.detail,
            }
            : null,
    };
    return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, payload));
}
