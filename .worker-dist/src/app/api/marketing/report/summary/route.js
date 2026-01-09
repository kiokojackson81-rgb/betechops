"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingPeriod_1 = require("@/lib/marketingPeriod");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const commission_1 = require("@/lib/commission");
const marketingUnpricedSales_1 = require("@/lib/marketingUnpricedSales");
const prisma_1 = require("@/lib/prisma");
const timezone_1 = require("@/lib/timezone");
const posReceiptSummary_1 = require("@/lib/posReceiptSummary");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    // debug gate: add ?debug=1 to get diagnostic info (no change to payload when off)
    const debug = url.searchParams.get("debug") === "1";
    const impersonateId = url.searchParams.get("impersonateId");
    const actorId = await (0, api_1.getActorId)();
    const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
    if (!targetUserId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const targetUser = await prisma_1.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { email: true, name: true },
    });
    const targetUserEmail = targetUser?.email?.toLowerCase() ?? null;
    const targetUserName = targetUser?.name ?? null;
    const isJeniffer = targetUserEmail === "jeniffer@betech.co.ke";
    const today = (0, timezone_1.nowInNairobi)();
    const { tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(today);
    const current = await (0, marketingPeriod_1.getCurrentTradingPeriodFor)(today);
    let argPeriod = {
        start: current.startDate,
        end: current.endDate,
        key: current.key,
        label: current.label,
    };
    if (!(today >= argPeriod.start && today <= argPeriod.end)) {
        const fallback = (0, tradingPeriod_1.getTradingPeriodFor)(today);
        argPeriod = {
            start: fallback.start,
            end: fallback.end,
            key: fallback.key,
            label: fallback.label,
        };
    }
    const [marketingSummary, supportSummary] = await Promise.all([
        (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId: targetUserId, period: argPeriod }),
        (0, supportEntries_1.getSupportPeriodAggregates)({ userId: targetUserId, period: argPeriod }),
    ]);
    const marketingTotals = marketingSummary?.totals ?? {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
        totalNewProducts: 0,
        totalEditedProducts: 0,
        totalCopiedProducts: 0,
        walkInsServed: 0,
        walkInsPurchased: 0,
        paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
    };
    const supportAggregates = supportSummary?.aggregates ?? {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
        newBatteries: 0,
        changedBatteries: 0,
        paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
    };
    // per-receipt maps returned by the summarizers (keyed by canonical receipt id)
    const marketingPer = marketingSummary?.perReceipts ?? {};
    const supportPer = supportSummary?.perReceipts ?? {};
    let totalSales = 0;
    let totalProfit = 0;
    let totalItems = 0;
    let totalReceipts = 0;
    let mergedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
    let posSummary = null;
    if (isJeniffer) {
        posSummary = await (0, posReceiptSummary_1.summarizePosReceiptsForPeriod)({ start: argPeriod.start, end: argPeriod.end });
        totalSales = posSummary.totalSales;
        totalProfit = posSummary.totalProfit;
        totalItems = posSummary.totalItems;
        totalReceipts = posSummary.totalReceipts;
        mergedPaymentStats = posSummary.paymentStats;
    }
    else {
        // Merge with precedence: MARKETING > SUPPORT
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
        for (const [, v] of merged) {
            totalSales += v.sales;
            totalProfit += v.profit;
            totalItems += v.items;
            mergedPaymentStats.totalSalesMpesa += v.mpesa;
            mergedPaymentStats.totalSalesCash += v.cash;
            if (v.mpesa > 0)
                mergedPaymentStats.countMpesaReceipts += 1;
            if (v.cash > 0)
                mergedPaymentStats.countCashReceipts += 1;
        }
        totalReceipts = merged.size;
    }
    let commission = 0;
    if (isJeniffer && posSummary) {
        commission = (0, commission_1.computeSalesCommissionFromTiers)(posSummary.totalSales, posSummary.totalProfit, tiers, 0);
    }
    else if (totalSales > 0) {
        commission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers);
    }
    try {
        if (!isJeniffer && targetUserEmail) {
            const unpriced = await (0, marketingUnpricedSales_1.getUnpricedDailySalesForCurrentPeriod)();
            const hasUnpricedForUser = unpriced.some((s) => (s.attendantEmail ?? "").toLowerCase() === targetUserEmail);
            if (hasUnpricedForUser) {
                commission = 0;
            }
        }
    }
    catch {
        // ignore
    }
    if (!isJeniffer) {
        try {
            const ledger = await prisma_1.prisma.commissionLedger.findUnique({
                where: {
                    userId_periodStart_periodEnd: {
                        userId: targetUserId,
                        periodStart: argPeriod.start,
                        periodEnd: argPeriod.end,
                    },
                },
            });
            if (ledger) {
                const persistedTotal = Number(ledger.commissionTotal ?? ledger.commission_total ?? 0);
                if (persistedTotal > 0) {
                    commission = persistedTotal;
                }
                else {
                    const detail = ledger.detail ?? {};
                    const marketingCommission = Number(detail.marketing?.commission ?? 0);
                    const supportCommission = Number(detail.support?.commission ?? 0);
                    const combinedDetailCommission = marketingCommission + supportCommission;
                    if (combinedDetailCommission > 0) {
                        commission = combinedDetailCommission;
                    }
                    else {
                        const ledgerNet = Number(ledger.netCommission ?? ledger.grossCommission ?? commission);
                        commission = Number.isFinite(ledgerNet) ? ledgerNet : commission;
                    }
                }
            }
        }
        catch {
            // ignore
        }
    }
    // base response
    const payload = {
        period: {
            key: String(argPeriod.key ?? ""),
            label: String(argPeriod.label ?? ""),
            start: argPeriod.start.toISOString(),
            end: argPeriod.end.toISOString(),
        },
        aggregates: {
            totalSales,
            totalReceipts,
            totalItems,
            paymentStats: mergedPaymentStats,
            commission: { commission },
        },
    };
    // When debug=1, attach identity proof and contribution audits
    if (debug) {
        // identity proof (include name/email and server time)
        const identity = {
            authRole: auth.role,
            actorId,
            impersonateId,
            targetUserId,
            targetUserEmail,
            impersonationHonored: Boolean(impersonateId && auth.role === "ADMIN"),
            serverNowISO: new Date().toISOString(),
        };
        // MARKETING audit
        const marketingPer = marketingSummary?.perReceipts ?? {};
        const marketingKeys = Object.keys(marketingPer || {});
        let marketingReceipts = [];
        // count marketing receipts in period for this target (by submittedById/email/name when available)
        const marketingCount = await prisma_1.prisma.marketingReceipt.count({
            where: {
                createdAt: { gte: argPeriod.start, lte: argPeriod.end },
                OR: [
                    { dailyEntry: { submittedById: targetUserId } },
                    ...(targetUserEmail ? [{ dailyEntry: { submittedByEmail: targetUserEmail } }] : []),
                    ...(targetUserName ? [{ dailyEntry: { submittedByName: targetUserName } }] : []),
                ],
            },
        });
        if (marketingKeys.length > 0) {
            marketingReceipts = await prisma_1.prisma.marketingReceipt.findMany({
                where: { receiptKey: { in: marketingKeys } },
                select: {
                    id: true,
                    receiptNumber: true,
                    receiptKey: true,
                    createdAt: true,
                    sellingTotal: true,
                    buyingTotal: true,
                    dailyEntry: { select: { submittedById: true, submittedByEmail: true, submittedByName: true } },
                },
            });
        }
        const marketingOwners = new Set();
        const marketingOwnerEmails = new Set();
        const marketingRecords = marketingReceipts.map((r) => {
            const ownerId = r.dailyEntry?.submittedById ?? null;
            const ownerEmail = r.dailyEntry?.submittedByEmail ?? null;
            if (ownerId)
                marketingOwners.add(ownerId);
            if (ownerEmail)
                marketingOwnerEmails.add(String(ownerEmail).toLowerCase());
            return {
                id: r.id,
                receiptNumber: r.receiptNumber,
                receiptKey: r.receiptKey,
                createdAt: r.createdAt,
                sellingTotal: r.sellingTotal,
                buyingTotal: r.buyingTotal,
                ownerId,
                ownerEmail,
            };
        });
        const marketingForeign = marketingRecords.filter((r) => {
            if (r.ownerId)
                return r.ownerId !== targetUserId;
            if (r.ownerEmail && targetUserEmail)
                return String(r.ownerEmail).toLowerCase() !== String(targetUserEmail).toLowerCase();
            return false;
        });
        const marketingAudit = {
            countReceiptsInMap: marketingKeys.length,
            distinctOwnerIds: Array.from(marketingOwners),
            distinctOwnerEmails: Array.from(marketingOwnerEmails),
            foreignCount: marketingForeign.length,
            foreignExamples: marketingForeign.slice(0, 5),
            topReceipts: marketingRecords.slice(0, 10),
        };
        // SUPPORT audit
        const supportPer = supportSummary?.perReceipts ?? {};
        const supportKeys = Object.keys(supportPer || {});
        let supportReceipts = [];
        // support receipts count (supportDailyEntry uses submittedById)
        const supportCount = await prisma_1.prisma.supportReceipt.count({
            where: {
                createdAt: { gte: argPeriod.start, lte: argPeriod.end },
                dailyEntry: { submittedById: targetUserId },
            },
        });
        if (supportKeys.length > 0) {
            supportReceipts = await prisma_1.prisma.supportReceipt.findMany({
                where: { receiptKey: { in: supportKeys } },
                select: {
                    id: true,
                    receiptNumber: true,
                    receiptKey: true,
                    createdAt: true,
                    sellingTotal: true,
                    buyingTotal: true,
                    dailyEntry: { select: { submittedById: true } },
                },
            });
        }
        // count supportDailyEntry rows for this attendant in period
        const supportEntryCount = await prisma_1.prisma.supportDailyEntry.count({ where: { date: { gte: argPeriod.start, lte: argPeriod.end }, submittedById: targetUserId } });
        // POS receipts counts:
        // - total POS receipts in the period (uses `generatedAt`, same as POS summary)
        // - POS receipts issued by this user (also uses `generatedAt` + issuedById)
        const posCountAll = await prisma_1.prisma.receipt.count({ where: { generatedAt: { gte: argPeriod.start, lte: argPeriod.end } } });
        const posCountIssuedByUser = await prisma_1.prisma.receipt.count({ where: { generatedAt: { gte: argPeriod.start, lte: argPeriod.end }, issuedById: targetUserId } });
        const supportOwners = new Set();
        const supportOwnerEmails = new Set();
        const supportRecords = supportReceipts.map((r) => {
            const ownerId = r.dailyEntry?.submittedById ?? null;
            const ownerEmail = r.dailyEntry?.submittedByEmail ?? null;
            if (ownerId)
                supportOwners.add(ownerId);
            if (ownerEmail)
                supportOwnerEmails.add(String(ownerEmail).toLowerCase());
            return {
                id: r.id,
                receiptNumber: r.receiptNumber,
                receiptKey: r.receiptKey,
                createdAt: r.createdAt,
                sellingTotal: r.sellingTotal,
                buyingTotal: r.buyingTotal,
                ownerId,
                ownerEmail,
            };
        });
        const supportForeign = supportRecords.filter((r) => {
            if (r.ownerId)
                return r.ownerId !== targetUserId;
            if (r.ownerEmail && targetUserEmail)
                return String(r.ownerEmail).toLowerCase() !== String(targetUserEmail).toLowerCase();
            return false;
        });
        const supportAudit = {
            countReceiptsInMap: supportKeys.length,
            distinctOwnerIds: Array.from(supportOwners),
            distinctOwnerEmails: Array.from(supportOwnerEmails),
            foreignCount: supportForeign.length,
            foreignExamples: supportForeign.slice(0, 5),
            topReceipts: supportRecords.slice(0, 10),
        };
        // build db metadata
        let dbMeta = { dbName: null, schema: null, host: null, urlSuffix: null };
        try {
            const meta = await prisma_1.prisma.$queryRaw `select current_database() as db, current_schema() as schema`;
            if (Array.isArray(meta) && meta[0]) {
                dbMeta.dbName = meta[0].db ?? null;
                dbMeta.schema = meta[0].schema ?? null;
            }
            else if (meta && meta.db) {
                dbMeta.dbName = meta.db ?? null;
                dbMeta.schema = meta.schema ?? null;
            }
        }
        catch (e) {
            // ignore
        }
        try {
            const rawUrl = process.env.DATABASE_URL ?? null;
            if (rawUrl) {
                try {
                    const parsed = new URL(rawUrl);
                    dbMeta.host = parsed.hostname ?? null;
                    const s = String(rawUrl);
                    dbMeta.urlSuffix = s.slice(-4);
                }
                catch (e) {
                    // fallback: try to extract host via regex
                    const m = rawUrl.match(/@([^:/?#]+)([:/?#]|$)/);
                    dbMeta.host = m ? m[1] : null;
                    dbMeta.urlSuffix = String(rawUrl).slice(-4);
                }
            }
        }
        catch (e) {
            // ignore
        }
        // source counts and totals
        const marketingTotalsVal = marketingTotals ?? { totalSales: 0, totalItems: 0 };
        const supportTotalsVal = supportAggregates ?? { totalSales: 0, totalItems: 0 };
        const sourceCounts = {
            marketingTotals: { totalSales: Number(marketingTotalsVal.totalSales ?? 0), totalItems: Number(marketingTotalsVal.totalItems ?? 0) },
            supportTotals: { totalSales: Number(supportTotalsVal.totalSales ?? 0), totalItems: Number(supportTotalsVal.totalItems ?? 0) },
            supportEntryCount,
            marketingRowCount: marketingCount,
            receiptsPerSource: { marketing: marketingKeys.length, support: supportKeys.length, pos: posCountAll, posIssuedBy: posCountIssuedByUser },
        };
        // final diagnosis
        const diagnosis = {
            impersonationHonored: Boolean(impersonateId && auth.role === "ADMIN"),
            actorEqualsTarget: actorId === targetUserId,
            marketingHasForeignRows: marketingAudit.foreignCount > 0,
            supportHasForeignRows: supportAudit.foreignCount > 0,
            marketingHasMultipleOwners: (marketingAudit.distinctOwnerIds.length > 1),
            supportHasMultipleOwners: (supportAudit.distinctOwnerIds.length > 1),
        };
        const sanity = {
            targetHasAnyRows: (marketingCount + supportCount) > 0,
            totalsNonZero: totalSales > 0 || totalItems > 0,
        };
        payload.debug = { identity, db: dbMeta, sourceCounts, marketing: marketingAudit, support: supportAudit, diagnosis, sanity };
    }
    const res = server_1.NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    return res;
}
/*
Sample curl (admin session cookie required):

curl -s -H "Cookie: <ADMIN_SESSION_COOKIE>" "https://ops.betech.co.ke/api/marketing/report/summary?impersonateId=cmimxqfgo0004v5mc5pn1r486&debug=1"

curl -s -H "Cookie: <ADMIN_SESSION_COOKIE>" "https://ops.betech.co.ke/api/marketing/report/summary?impersonateId=cmimxqfve0006v5mcewkm8waa&debug=1"

*/
