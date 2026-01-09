"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePaymentMethod = void 0;
exports.computeAdminReceiptSummary = computeAdminReceiptSummary;
const prisma_1 = require("@/lib/prisma");
const receiptGuard_1 = require("@/lib/receiptGuard");
const normalizePaymentMethod = (value) => {
    if (!value)
        return null;
    const normalized = value.toUpperCase().trim();
    if (normalized === "CASH" || normalized === "MPESA")
        return normalized;
    return null;
};
exports.normalizePaymentMethod = normalizePaymentMethod;
const sumItemQuantities = (items) => items.reduce((sum, item) => sum + (Number(item?.quantity ?? 1) || 0), 0);
const buildReceiptKey = (source, receiptNumber, fallbackId) => {
    const normalized = receiptNumber ? (0, receiptGuard_1.canonicalReceiptNumber)(receiptNumber) : null;
    if (normalized)
        return `num:${normalized}`;
    return `${source}:${fallbackId}`;
};
const buildPosSearchOr = (q) => [
    { order: { customerName: { contains: q, mode: "insensitive" } } },
    { order: { customerPhone: { contains: q, mode: "insensitive" } } },
    { order: { customerEmail: { contains: q, mode: "insensitive" } } },
    { order: { orderNumber: { contains: q, mode: "insensitive" } } },
    { order: { attendant: { name: { contains: q, mode: "insensitive" } } } },
    { issuedBy: { name: { contains: q, mode: "insensitive" } } },
];
const buildMarketingSupportSearchOr = (q) => [
    { receiptNumber: { contains: q, mode: "insensitive" } },
    { dailyEntry: { submittedByName: { contains: q, mode: "insensitive" } } },
    { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
];
const buildSupportSearchOr = (q) => [
    { receiptNumber: { contains: q, mode: "insensitive" } },
    {
        dailyEntry: {
            submittedBy: { name: { contains: q, mode: "insensitive" } },
        },
    },
    { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
];
const buildPosScopeCondition = (userId) => {
    if (!userId)
        return [];
    return [
        { issuedById: userId },
        { order: { attendantId: userId } },
        { data: { path: ["attendantId"], equals: userId } },
    ];
};
async function computeAdminReceiptSummary({ start, end, attendantId, paymentMethod, search, docType, scope = "global", currentUserId, }) {
    const normalizedDocType = docType ? docType.toUpperCase() : undefined;
    const isMarketingDocType = normalizedDocType === "MARKETING";
    const isSupportDocType = normalizedDocType === "SUPPORT";
    const includePosReceipts = !normalizedDocType || (!isMarketingDocType && !isSupportDocType);
    const includeMarketingReceipts = !normalizedDocType || isMarketingDocType;
    const includeSupportReceipts = !normalizedDocType || isSupportDocType;
    const posWhere = {
        generatedAt: { gte: start, lte: end },
    };
    if (normalizedDocType && includePosReceipts) {
        posWhere.docType = normalizedDocType;
    }
    if (search) {
        posWhere.OR = [...(posWhere.OR ?? []), ...buildPosSearchOr(search)];
    }
    if (scope === "mine") {
        const ownerOr = buildPosScopeCondition(currentUserId);
        if (ownerOr.length) {
            posWhere.AND = [...(posWhere.AND ?? []), { OR: ownerOr }];
        }
    }
    else if (attendantId) {
        const ownerOr = buildPosScopeCondition(attendantId);
        if (ownerOr.length) {
            posWhere.AND = [...(posWhere.AND ?? []), { OR: ownerOr }];
        }
    }
    if (paymentMethod) {
        posWhere.data ?? (posWhere.data = {});
        posWhere.data.path = ["paymentMethod"];
        posWhere.data.equals = paymentMethod;
    }
    const dailyEntryWhere = {
        date: { gte: start, lte: end },
    };
    if (scope === "mine") {
        dailyEntryWhere.submittedById = currentUserId ?? attendantId ?? undefined;
    }
    else if (attendantId) {
        dailyEntryWhere.submittedById = attendantId;
    }
    if (paymentMethod) {
        dailyEntryWhere.paymentMethod = paymentMethod;
    }
    const [marketingReceipts, supportReceipts, posReceipts] = await Promise.all([
        includeMarketingReceipts
            ? prisma_1.prisma.marketingReceipt.findMany({
                where: {
                    dailyEntry: dailyEntryWhere,
                    ...(search ? { OR: buildMarketingSupportSearchOr(search) } : {}),
                },
                include: { items: true },
            })
            : [],
        includeSupportReceipts
            ? prisma_1.prisma.supportReceipt.findMany({
                where: {
                    dailyEntry: dailyEntryWhere,
                    ...(search ? { OR: buildSupportSearchOr(search) } : {}),
                },
                include: { items: true },
            })
            : [],
        includePosReceipts
            ? prisma_1.prisma.receipt.findMany({
                where: posWhere,
                include: {
                    order: {
                        include: {
                            items: {
                                select: { quantity: true },
                            },
                        },
                    },
                },
            })
            : [],
    ]);
    const marketingRecords = marketingReceipts.map((receipt) => ({
        source: "marketing",
        key: buildReceiptKey("marketing", receipt.receiptNumber ?? null, receipt.id),
        paymentMethod: (0, exports.normalizePaymentMethod)(receipt.paymentMethod) ?? null,
        sellingTotal: Number(receipt.sellingTotal ?? 0),
        items: receipt.items ?? [],
        buyingTotal: Number(receipt.buyingTotal ?? 0),
    }));
    const supportRecords = supportReceipts.map((receipt) => ({
        source: "support",
        key: buildReceiptKey("support", receipt.receiptNumber ?? null, receipt.id),
        paymentMethod: (0, exports.normalizePaymentMethod)(receipt.paymentMethod) ?? null,
        sellingTotal: Number(receipt.sellingTotal ?? 0),
        items: receipt.items ?? [],
        buyingTotal: Number(receipt.buyingTotal ?? 0),
    }));
    const posRecords = posReceipts.map((receipt) => {
        const orderRef = receipt.order?.orderNumber ?? null;
        return {
            source: "pos",
            key: buildReceiptKey("pos", orderRef, receipt.id),
            paymentMethod: (0, exports.normalizePaymentMethod)(receipt.data?.paymentMethod) ?? null,
            sellingTotal: Number(receipt.totals?.total ?? receipt.order?.totalAmount ?? 0),
            items: (receipt.order?.items ?? []).map((item) => ({ quantity: item.quantity })),
        };
    });
    const combinedRecords = [...marketingRecords, ...supportRecords, ...posRecords];
    const sourcePriority = {
        pos: 3,
        marketing: 2,
        support: 1,
    };
    const dedupedMap = new Map();
    const recordHasCostData = (record) => {
        if (Number(record.buyingTotal ?? 0) > 0)
            return true;
        const items = Array.isArray(record.items) ? record.items : [];
        return items.some((item) => Number(item?.buyingPrice ?? 0) > 0);
    };
    for (const record of combinedRecords) {
        const existing = dedupedMap.get(record.key);
        const candidateHasCost = recordHasCostData(record);
        const existingHasCost = existing ? recordHasCostData(existing) : false;
        const shouldReplace = () => {
            if (!existing)
                return true;
            // If a marketing row exists but lacks cost information and the
            // support row for the same receipt has cost, prefer the support row
            // to avoid losing buying-price-derived profit information.
            if (existing.source === "marketing" && record.source === "support" && !existingHasCost && candidateHasCost) {
                return true;
            }
            if (candidateHasCost !== existingHasCost)
                return candidateHasCost;
            return sourcePriority[record.source] > sourcePriority[existing.source];
        };
        if (shouldReplace()) {
            const merged = { ...record };
            if (existing?.paymentMethod) {
                merged.paymentMethod = existing.paymentMethod;
            }
            dedupedMap.set(record.key, merged);
        }
    }
    const dedupedRecords = Array.from(dedupedMap.values());
    const paymentTotals = dedupedRecords.reduce((acc, { paymentMethod: method, sellingTotal }) => {
        const normalized = (0, exports.normalizePaymentMethod)(method);
        if (!normalized)
            return acc;
        const bucket = normalized === "CASH" ? acc.cash : acc.mpesa;
        bucket.totalSales += Number(sellingTotal);
        bucket.count += 1;
        return acc;
    }, {
        mpesa: { totalSales: 0, count: 0 },
        cash: { totalSales: 0, count: 0 },
    });
    const filteredRecords = paymentMethod
        ? dedupedRecords.filter((receipt) => (0, exports.normalizePaymentMethod)(receipt.paymentMethod) === paymentMethod)
        : dedupedRecords;
    const filteredMarketingSupport = filteredRecords.filter((record) => record.source !== "pos");
    const filteredPos = filteredRecords.filter((record) => record.source === "pos");
    const totalSales = filteredMarketingSupport.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0) +
        filteredPos.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0);
    const marketingItemsCount = filteredMarketingSupport.reduce((sum, receipt) => sum + sumItemQuantities(receipt.items), 0);
    const posItemsCount = filteredPos.reduce((sum, receipt) => sum + sumItemQuantities(receipt.items), 0);
    const itemsCount = marketingItemsCount + posItemsCount;
    const receiptsCount = filteredRecords.length;
    let totalCost = 0;
    let totalProfitPriced = 0;
    let totalProfitInclusive = 0;
    let awaitingPricingCount = 0;
    let hasIncompleteCosts = false;
    for (const receipt of filteredMarketingSupport) {
        const items = Array.isArray(receipt.items) ? receipt.items : [];
        const aggregateCost = Number(receipt.buyingTotal ?? 0);
        const allItemsPriced = items.length > 0 && items.every((it) => Number(it?.buyingPrice ?? 0) > 0);
        const hasAggregateCost = aggregateCost > 0;
        const sell = Number(receipt.sellingTotal ?? 0);
        let receiptProfit = 0;
        if (hasAggregateCost || allItemsPriced) {
            const buyingSum = hasAggregateCost
                ? aggregateCost
                : items.reduce((sum, it) => sum + Number(it?.buyingPrice ?? 0), 0);
            totalCost += buyingSum;
            receiptProfit = sell - buyingSum;
            totalProfitPriced += receiptProfit;
        }
        else {
            awaitingPricingCount += 1;
            hasIncompleteCosts = true;
            receiptProfit = 0;
        }
        totalProfitInclusive += receiptProfit;
    }
    const hasCompleteCosts = filteredMarketingSupport.length === 0 ? true : !hasIncompleteCosts;
    return {
        totalSales,
        totalCost,
        totalProfit: totalProfitInclusive,
        totalProfitPriced,
        totalProfitInclusive,
        receiptsCount,
        itemsCount,
        hasCompleteCosts,
        awaitingPricingCount,
        paymentTotals,
    };
}
