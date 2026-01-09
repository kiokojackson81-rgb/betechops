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
const commission_1 = require("@/lib/commission");
const directSalesLedger_1 = require("@/lib/directSalesLedger");
const receiptKey_1 = require("@/lib/receiptKey");
const posReceiptSummary_1 = require("@/lib/posReceiptSummary");
exports.dynamic = "force-dynamic";
async function fetchMarketingContributions(userId, period) {
    const rows = await prisma_1.prisma.marketingReceipt.findMany({
        where: {
            dailyEntry: {
                submittedById: userId,
                date: { gte: period.start, lte: period.end },
            },
        },
        select: {
            id: true,
            receiptNumber: true,
            sellingTotal: true,
            buyingTotal: true,
            paymentMethod: true,
            createdAt: true,
            _count: { select: { items: true } },
            dailyEntry: { select: { submittedById: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return rows
        .map((row) => {
        const receiptId = (0, receiptKey_1.normalizeReceiptId)(row.receiptNumber) || (0, receiptKey_1.normalizeReceiptId)(row.id);
        if (!receiptId)
            return null;
        const sales = Number(row.sellingTotal ?? 0);
        const profit = Math.max(0, sales - Number(row.buyingTotal ?? 0));
        const items = Number(row._count?.items ?? 0);
        return {
            receiptId,
            rawId: row.receiptNumber ?? row.id,
            source: "marketing",
            sales,
            profit,
            items,
            paymentMethod: row.paymentMethod ?? null,
            attribution: { submittedById: row.dailyEntry?.submittedById ?? null },
            createdAt: row.createdAt,
        };
    })
        .filter((it) => Boolean(it));
}
async function fetchSupportContributions(userId, period) {
    const rows = await prisma_1.prisma.supportReceipt.findMany({
        where: {
            dailyEntry: {
                submittedById: userId,
                date: { gte: period.start, lte: period.end },
            },
        },
        select: {
            id: true,
            receiptNumber: true,
            sellingTotal: true,
            buyingTotal: true,
            paymentMethod: true,
            createdAt: true,
            _count: { select: { items: true } },
            dailyEntry: { select: { submittedById: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return rows
        .map((row) => {
        const receiptId = (0, receiptKey_1.normalizeReceiptId)(row.receiptNumber) || (0, receiptKey_1.normalizeReceiptId)(row.id);
        if (!receiptId)
            return null;
        const sales = Number(row.sellingTotal ?? 0);
        const profit = Math.max(0, sales - Number(row.buyingTotal ?? 0));
        const items = Number(row._count?.items ?? 0);
        return {
            receiptId,
            rawId: row.receiptNumber ?? row.id,
            source: "support",
            sales,
            profit,
            items,
            paymentMethod: row.paymentMethod ?? null,
            attribution: { submittedById: row.dailyEntry?.submittedById ?? null },
            createdAt: row.createdAt,
        };
    })
        .filter((it) => Boolean(it));
}
async function GET(req) {
    const url = new URL(req.url);
    const impersonateId = url.searchParams.get("impersonateId");
    const isDebug = url.searchParams.get("debug") === "1";
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    const actorId = session?.user?.id;
    if (!actorId && !impersonateId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (impersonateId && session?.user?.role !== "ADMIN") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = impersonateId ?? actorId;
    if (!userId)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });
    const isJeniffer = (user?.email ?? "").toLowerCase() === "jeniffer@betech.co.ke";
    const now = new Date();
    const { tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(now);
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    const jenifferPosSummary = isJeniffer ? await (0, posReceiptSummary_1.summarizePosReceiptsForPeriod)(period) : null;
    const [summary, marketingSummary, supportSummary] = await Promise.all([
        (0, earningsSummary_1.getEarningsSummaryForUser)({ userId }),
        (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId, period }),
        (0, supportEntries_1.getSupportPeriodAggregates)({ userId, period }),
    ]);
    const [marketingContributions, supportContributions] = await Promise.all([
        fetchMarketingContributions(userId, period),
        fetchSupportContributions(userId, period),
    ]);
    await (0, marketingPeriodTotals_1.recomputeMarketingCommissionLedger)({ userId, period, client: prisma_1.prisma });
    if (isJeniffer) {
        try {
            await (0, directSalesLedger_1.recomputeDirectSalesLedger)({ userId, period, client: prisma_1.prisma });
        }
        catch (e) {
            console.error('Failed to recompute direct sales ledger for Jeniffer', e);
        }
    }
    const ledger = await prisma_1.prisma.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
    });
    const supportTotals = supportSummary?.aggregates ?? {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
    };
    const contributions = [...marketingContributions, ...supportContributions];
    const priority = {
        marketing: 2,
        support: 1,
    };
    const orderedContributions = [...contributions].sort((a, b) => {
        if (priority[b.source] !== priority[a.source]) {
            return priority[b.source] - priority[a.source];
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const dedupedMap = new Map();
    const intersectionMap = new Map();
    const mismatches = [];
    for (const contribution of orderedContributions) {
        if (!dedupedMap.has(contribution.receiptId)) {
            dedupedMap.set(contribution.receiptId, contribution);
        }
        const sources = intersectionMap.get(contribution.receiptId) ?? new Set();
        sources.add(contribution.source);
        intersectionMap.set(contribution.receiptId, sources);
        if (contribution.attribution.submittedById && contribution.attribution.submittedById !== userId) {
            mismatches.push(contribution);
        }
    }
    let dedupedSales = 0;
    let dedupedProfit = 0;
    let dedupedItems = 0;
    const dedupedPaymentStats = {
        totalSalesCash: 0,
        totalSalesMpesa: 0,
        countCashReceipts: 0,
        countMpesaReceipts: 0,
    };
    dedupedMap.forEach((contribution) => {
        dedupedSales += contribution.sales;
        dedupedProfit += contribution.profit;
        dedupedItems += contribution.items;
        const method = contribution.paymentMethod;
        if (method === "CASH") {
            dedupedPaymentStats.totalSalesCash += contribution.sales;
            dedupedPaymentStats.countCashReceipts += 1;
        }
        else if (method === "MPESA") {
            dedupedPaymentStats.totalSalesMpesa += contribution.sales;
            dedupedPaymentStats.countMpesaReceipts += 1;
        }
    });
    const dedupedTotals = {
        totalSales: dedupedSales,
        totalProfit: dedupedProfit,
        totalItems: dedupedItems,
        totalReceipts: dedupedMap.size,
        paymentStats: dedupedPaymentStats,
    };
    const marketingSamples = marketingContributions
        .slice(0, 50)
        .map((c) => ({
        receiptId: c.receiptId,
        rawId: c.rawId,
        source: c.source,
        sales: c.sales,
        profit: c.profit,
        items: c.items,
        paymentMethod: c.paymentMethod,
        attribution: c.attribution,
    }));
    const supportSamples = supportContributions
        .slice(0, 50)
        .map((c) => ({
        receiptId: c.receiptId,
        rawId: c.rawId,
        source: c.source,
        sales: c.sales,
        profit: c.profit,
        items: c.items,
        paymentMethod: c.paymentMethod,
        attribution: c.attribution,
    }));
    const intersections = Array.from(intersectionMap.entries())
        .filter(([, sources]) => sources.size > 1)
        .map(([receiptId, sources]) => ({
        receiptId,
        sources: Array.from(sources),
    }));
    const debugInfo = isDebug
        ? {
            totals: {
                earnings: {
                    totalSales: summary.totalSales,
                    totalProfit: summary.totalProfit,
                    totalReceipts: summary.totalReceipts ?? 0,
                },
                marketing: marketingSummary.totals,
                support: supportTotals,
                deduped: dedupedTotals,
            },
            samples: {
                marketing: marketingSamples,
                support: supportSamples,
            },
            intersections,
            mismatches: mismatches.slice(0, 50).map((c) => ({
                receiptId: c.receiptId,
                rawId: c.rawId,
                source: c.source,
                sales: c.sales,
                profit: c.profit,
                items: c.items,
                paymentMethod: c.paymentMethod,
                attribution: c.attribution,
            })),
        }
        : undefined;
    const combinedSales = jenifferPosSummary?.totalSales ?? dedupedTotals.totalSales;
    const combinedProfit = jenifferPosSummary?.totalProfit ?? dedupedTotals.totalProfit;
    const combinedItems = jenifferPosSummary?.totalItems ?? dedupedTotals.totalItems;
    const combinedReceipts = jenifferPosSummary?.totalReceipts ?? dedupedTotals.totalReceipts;
    const detail = ledger?.detail;
    const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
    const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
    let salesCommission = marketingCommission + supportCommission;
    // Prefer persisted, authoritative commissionTotal when present
    if (ledger && Number(ledger.commissionTotal ?? 0) > 0) {
        salesCommission = Number(ledger.commissionTotal);
    }
    else {
        if (salesCommission === 0 && ledger) {
            salesCommission = Number(ledger.grossCommission ?? 0);
        }
        if (salesCommission === 0) {
            salesCommission = summary.salesCommission;
        }
    }
    if (isJeniffer && jenifferPosSummary) {
        salesCommission = (0, commission_1.computeSalesCommissionFromTiers)(jenifferPosSummary.totalSales, jenifferPosSummary.totalProfit, tiers, 0);
    }
    const grossCommission = salesCommission +
        summary.newProductCommission +
        summary.copiedCommission +
        summary.editedCommission +
        summary.commissionTopUpTotal;
    const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
    const totalDeductions = summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    const baseResponse = {
        // canonical/per-receipt helpers for clients to dedupe local receipts
        perReceiptIds: Array.from(dedupedMap.keys()),
        perReceiptCanonicalKeys: Array.from(dedupedMap.values()).map((c) => {
            try {
                const date = c.createdAt ? new Date(c.createdAt) : new Date();
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                const businessDate = `${y}-${m}-${d}`;
                const serial = String(c.rawId ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                if (serial && serial.length > 0)
                    return `${businessDate}:${serial}`;
                return `ID:${String(c.rawId ?? c.receiptId ?? "")}`;
            }
            catch (e) {
                return String(c.receiptId ?? c.rawId ?? "");
            }
        }),
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
                commissionTotal: Number(ledger.commissionTotal ?? 0),
                penalties: Number(ledger.penalties),
                detail: ledger.detail,
            }
            : null,
    };
    if (debugInfo) {
        return server_1.NextResponse.json({ ...baseResponse, debug: debugInfo });
    }
    return server_1.NextResponse.json(baseResponse);
}
