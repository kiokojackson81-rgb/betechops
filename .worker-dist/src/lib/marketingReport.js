"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketingReport = getMarketingReport;
exports.getMarketingSummary = getMarketingSummary;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("./tradingPeriod");
const commissionCommon_1 = require("./commissionCommon");
const marketingCommission_1 = require("./marketingCommission");
const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const computeEntryTotals = (entry) => {
    if (entry.receipts && entry.receipts.length) {
        const totalSales = entry.receipts.reduce((sum, r) => sum + toNumber(r.sellingTotal), 0);
        const totalProfit = entry.receipts.reduce((sum, r) => {
            const items = r.items || [];
            const fallbackCost = items.reduce((s, it) => s + toNumber(it.buyingPrice), 0);
            const aggregateCost = toNumber(r.buyingTotal);
            const hasAggregateCost = aggregateCost > 0;
            const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it.buyingPrice) > 0);
            if (hasAggregateCost || allItemsPriced) {
                const buyingSum = hasAggregateCost ? aggregateCost : fallbackCost;
                return sum + (toNumber(r.sellingTotal) - buyingSum);
            }
            // costs incomplete for this receipt; skip including its profit
            return sum;
        }, 0);
        return { totalSales, totalProfit, totalItems: entry.receipts.reduce((s, r) => s + (r.items?.length || 0), 0) };
    }
    const totalSales = toNumber(entry.totalSales);
    const totalProfit = toNumber(entry.totalProfit);
    const totalItems = entry.sales?.length ?? 0;
    return { totalSales, totalProfit, totalItems };
};
const normalizeEntry = (entry) => {
    const totals = computeEntryTotals(entry);
    return {
        ...entry,
        date: entry.date.toISOString(),
        totalSales: totals.totalSales,
        totalProfit: totals.totalProfit,
        createdAt: entry.createdAt.toISOString?.() ?? undefined,
        updatedAt: entry.updatedAt.toISOString?.() ?? undefined,
        sales: entry.sales,
        receipts: entry.receipts,
        source: "MARKETING",
    };
};
const normalizeAttendantEntry = (entry) => {
    const sales = entry.sales ?? [];
    const guaranteedTotalSales = toNumber(entry.totalSales) || sales.reduce((sum, sale) => sum + toNumber(sale.price), 0);
    const costSum = sales.reduce((sum, sale) => sum + toNumber(sale.price), 0);
    const receipts = sales.length > 0
        ? [
            {
                id: undefined,
                receiptNumber: sales[0].receiptNumber || entry.id,
                sellingTotal: guaranteedTotalSales,
                paymentMethod: sales[0].paymentMethod ?? "MPESA",
                items: sales.map((sale) => ({
                    id: sale.id,
                    productName: sale.productName,
                    buyingPrice: toNumber(sale.price),
                })),
            },
        ]
        : [];
    // Cast receipts to the Prisma type shape expected by the report
    const receiptsCasted = receipts;
    const totalProfit = receipts.reduce((sum, receipt) => sum + (toNumber(receipt.sellingTotal) - receipt.items.reduce((acc, it) => acc + toNumber(it.buyingPrice), 0)), 0);
    const normalizedSales = sales.map((sale) => {
        const cost = toNumber(sale.price);
        const share = sales.length > 0
            ? costSum > 0
                ? (cost / costSum) * guaranteedTotalSales
                : guaranteedTotalSales / sales.length
            : 0;
        return {
            product: sale.productName,
            buyingPrice: cost,
            sellingPrice: share,
            paymentMethod: sale.paymentMethod ?? "MPESA",
            itemsCount: 1,
        };
    });
    // Cast to MarketingSale[] for compatibility with reporting types
    const normalizedSalesCasted = normalizedSales;
    const result = {
        id: entry.id,
        date: entry.date.toISOString(),
        dayOfWeek: entry.day,
        totalSales: guaranteedTotalSales,
        totalProfit,
        receipts: receiptsCasted,
        sales: normalizedSalesCasted,
        submittedById: entry.userId ?? null,
        submittedByName: entry.user?.name ?? entry.submittedBy ?? null,
        submittedByEmail: entry.user?.email ?? null,
        source: "ATTENDANT",
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
    };
    return result;
};
async function getMarketingReport(params) {
    const period = (params.tradingPeriodKey &&
        (0, tradingPeriod_1.getRecentTradingPeriods)(12).find((p) => p.key === params.tradingPeriodKey)) ||
        (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const marketingWhere = {
        date: { gte: period.start, lte: period.end },
    };
    const dailyWhere = {
        date: { gte: period.start, lte: period.end },
    };
    if (params.from) {
        marketingWhere.date = { ...(marketingWhere.date || {}), gte: params.from };
        dailyWhere.date = { ...(dailyWhere.date || {}), gte: params.from };
    }
    if (params.to) {
        marketingWhere.date = { ...(marketingWhere.date || {}), lte: params.to };
        dailyWhere.date = { ...(dailyWhere.date || {}), lte: params.to };
    }
    if (params.dayOfWeek) {
        marketingWhere.dayOfWeek = params.dayOfWeek;
        dailyWhere.day = params.dayOfWeek;
    }
    if (params.submittedById) {
        marketingWhere.submittedById = params.submittedById;
        dailyWhere.userId = params.submittedById;
    }
    const userFilter = params.userFilter?.trim();
    if (userFilter) {
        marketingWhere.OR = [
            { submittedBy: { contains: userFilter, mode: "insensitive" } },
            { submittedByName: { contains: userFilter, mode: "insensitive" } },
            { submittedByEmail: { contains: userFilter, mode: "insensitive" } },
            { submittedById: { contains: userFilter, mode: "insensitive" } },
        ];
        dailyWhere.OR = [
            { submittedBy: { contains: userFilter, mode: "insensitive" } },
            { user: { is: { name: { contains: userFilter, mode: "insensitive" } } } },
            { user: { is: { email: { contains: userFilter, mode: "insensitive" } } } },
        ];
    }
    const [marketingRaw, dailyRaw] = await Promise.all([
        prisma_1.prisma.marketingDailyEntry.findMany({
            where: marketingWhere,
            orderBy: { date: "desc" },
            include: { sales: true, receipts: { include: { items: true } } },
        }),
        prisma_1.prisma.dailyReport.findMany({
            where: dailyWhere,
            orderBy: { date: "desc" },
            include: { sales: true, user: { select: { id: true, name: true, email: true } } },
        }),
    ]);
    const marketingEntries = marketingRaw.map(normalizeEntry);
    const attendantEntries = dailyRaw.map((entry) => normalizeAttendantEntry(entry));
    const entries = [...marketingEntries, ...attendantEntries].sort((a, b) => b.date.localeCompare(a.date));
    const totalDaysLogged = entries.length;
    const totalSales = entries.reduce((acc, e) => acc + toNumber(e.totalSales), 0);
    const totalProfit = entries.reduce((acc, e) => acc + toNumber(e.totalProfit), 0);
    const totalItems = entries.reduce((acc, e) => {
        if (e.receipts && e.receipts.length) {
            return acc + e.receipts.reduce((s, r) => s + (r.items?.length || 0), 0);
        }
        if (e.sales && e.sales.length) {
            return acc + (e.sales || []).reduce((sum, s) => sum + toNumber(s.itemsCount || 1), 0);
        }
        return acc;
    }, 0);
    const totalEstimatedViewers = entries.reduce((acc, e) => acc + (e.liveSessionsEstimatedViewers ?? e.liveViewers ?? 0), 0);
    const totalLiveSessions = entries.reduce((acc, e) => acc + (e.liveSessionsCount ?? (e.liveSessionsEstimatedViewers || e.liveViewers ? 1 : 0)), 0);
    const durations = entries
        .map((e) => e.liveSessionDurationMinutes)
        .filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
    const avgLiveDurationMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const platformFreq = {};
    entries.forEach((e) => {
        if (e.liveSessionPlatform) {
            const p = e.liveSessionPlatform.trim();
            if (p)
                platformFreq[p] = (platformFreq[p] || 0) + 1;
        }
    });
    const topLivePlatform = Object.entries(platformFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const channelStats = {
        tiktokPostedDays: entries.filter((e) => e.tiktokPosted2Videos || e.tiktokPosted4ExplanatoryVideos || e.shot4ProductVideos).length,
        tiktokRepliedDays: entries.filter((e) => e.tiktokRepliedAll).length,
        igFbYtPostedDays: entries.filter((e) => e.igFbYtPosted2VideosEach).length,
        igFbYtRepliedDays: entries.filter((e) => e.igFbYtRepliedAll).length,
        waStatusDays: entries.filter((e) => e.waPostedStatus || e.waPosted10Statuses).length,
        waContactsDays: entries.filter((e) => e.waSavedContacts || e.waSaved10Contacts).length,
        waRepliedDays: entries.filter((e) => e.waRespondedAll).length,
    };
    const stockStats = { stockEnoughDays: entries.filter((e) => e.stockEnoughFastMovers).length };
    const shopStats = {
        shopCleanedDays: entries.filter((e) => e.shopCleaned).length,
        displayWellArrangedDays: entries.filter((e) => e.shopWellArranged).length,
        displayWellLabeledDays: entries.filter((e) => e.displayWellLabeled).length,
    };
    const paymentStats = entries.reduce((acc, e) => {
        if (e.receipts && e.receipts.length) {
            e.receipts.forEach((r) => {
                if (r.paymentMethod === "CASH") {
                    acc.totalSalesCash += toNumber(r.sellingTotal);
                    acc.countCashReceipts += 1;
                }
                else {
                    acc.totalSalesMpesa += toNumber(r.sellingTotal);
                    acc.countMpesaReceipts += 1;
                }
            });
        }
        else if (e.sales && e.sales.length) {
            e.sales.forEach((s) => {
                if (s.paymentMethod === "CASH") {
                    acc.totalSalesCash += toNumber(s.sellingPrice);
                    acc.countCashReceipts += 1;
                }
                else {
                    acc.totalSalesMpesa += toNumber(s.sellingPrice);
                    acc.countMpesaReceipts += 1;
                }
            });
        }
        return acc;
    }, { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 });
    const coreTasks = ["tiktokPosted2Videos", "tiktokRepliedAll", "waPostedStatus", "waRespondedAll", "stockEnoughFastMovers"];
    const completionRate = totalDaysLogged === 0
        ? 0
        : Math.round((entries.filter((e) => coreTasks.every((key) => Boolean(e[key]))).length / totalDaysLogged) * 100);
    const commission = (0, marketingCommission_1.getCommissionSummaryForSales)(totalSales);
    return {
        entries,
        aggregates: {
            period,
            totalDaysLogged,
            completionRate,
            totalSales,
            totalProfit,
            totalItems,
            totalLiveSessions,
            totalEstimatedViewers,
            avgLiveDurationMinutes,
            topLivePlatform,
            paymentStats,
            channelStats,
            stockStats,
            shopStats,
            commission,
        },
    };
}
async function getMarketingSummary(opts) {
    const { from, to } = opts;
    const entries = await prisma_1.prisma.marketingDailyEntry.findMany({
        where: { date: { gte: from, lte: to } },
        include: { receipts: { include: { items: true } }, sales: true },
        orderBy: { date: "asc" },
    });
    const daysMap = {};
    let totalSales = 0;
    let totalProfit = 0;
    let totalItems = 0;
    let mpesaTotal = 0;
    let cashTotal = 0;
    for (const e of entries) {
        const dateKey = e.date.toISOString().split("T")[0];
        let daySales = 0;
        let dayProfit = 0;
        let dayItems = 0;
        let dayMpesa = 0;
        let dayCash = 0;
        if (e.receipts && e.receipts.length) {
            for (const r of e.receipts) {
                const sell = Number(r.sellingTotal) || 0;
                daySales += sell;
                if (String(r.paymentMethod || "").toUpperCase() === "CASH") {
                    dayCash += sell;
                }
                else {
                    dayMpesa += sell;
                }
                const items = r.items || [];
                const fallbackCost = items.reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
                const aggregateCost = Number(r.buyingTotal ?? 0);
                const hasAggregateCost = aggregateCost > 0;
                const allItemsPriced = items.length > 0 && items.every((it) => Number(it.buyingPrice ?? 0) > 0);
                if (hasAggregateCost || allItemsPriced) {
                    const buyingTotal = hasAggregateCost ? aggregateCost : fallbackCost;
                    dayProfit += sell - buyingTotal;
                }
                // else: costs incomplete -> skip profit for this receipt
                dayItems += (r.items || []).length;
            }
        }
        else if (e.sales && e.sales.length) {
            for (const s of e.sales) {
                const sell = Number(s.sellingPrice ?? s.sellingPrice) || Number(s.sellingPrice ?? 0) || 0;
                daySales += sell;
                if (String((s.paymentMethod || "").toUpperCase()) === "CASH") {
                    dayCash += sell;
                }
                else {
                    dayMpesa += sell;
                }
                dayItems += Number(s.itemsCount ?? 1) || 0;
                // For legacy sales we don't compute per-item buyingPrice profit reliably; fallback to entry.totalProfit later
            }
            // fall back profit if entry.totalProfit present
            dayProfit = Number(e.totalProfit ?? 0) || 0;
        }
        else {
            daySales = Number(e.totalSales ?? 0) || 0;
            dayProfit = Number(e.totalProfit ?? 0) || 0;
        }
        daysMap[dateKey] = {
            date: dateKey,
            totalSales: Number(daySales) || 0,
            totalProfit: Number(dayProfit) || 0,
            items: Number(dayItems) || 0,
            mpesaTotal: Number(dayMpesa) || 0,
            cashTotal: Number(dayCash) || 0,
        };
        totalSales += daysMap[dateKey].totalSales;
        totalProfit += daysMap[dateKey].totalProfit;
        totalItems += daysMap[dateKey].items;
        mpesaTotal += daysMap[dateKey].mpesaTotal;
        cashTotal += daysMap[dateKey].cashTotal;
    }
    const dailyReports = await prisma_1.prisma.dailyReport.findMany({
        where: { date: { gte: from, lte: to } },
        include: { sales: true },
        orderBy: { date: "asc" },
    });
    for (const report of dailyReports) {
        const dateKey = report.date.toISOString().split("T")[0];
        const sales = report.sales ?? [];
        const daySales = toNumber(report.totalSales) || sales.reduce((sum, sale) => sum + toNumber(sale.price), 0);
        const dayItems = sales.length;
        const costSum = sales.reduce((sum, sale) => sum + toNumber(sale.price), 0);
        const dayProfit = daySales - costSum;
        let dayMpesa = 0;
        let dayCash = 0;
        sales.forEach((sale) => {
            const method = String(sale.paymentMethod ?? "MPESA").toUpperCase();
            const price = toNumber(sale.price);
            if (method === "CASH")
                dayCash += price;
            else
                dayMpesa += price;
        });
        const existing = daysMap[dateKey] ?? {
            date: dateKey,
            totalSales: 0,
            totalProfit: 0,
            items: 0,
            mpesaTotal: 0,
            cashTotal: 0,
        };
        existing.totalSales += daySales;
        existing.totalProfit += dayProfit;
        existing.items += dayItems;
        existing.mpesaTotal += dayMpesa;
        existing.cashTotal += dayCash;
        daysMap[dateKey] = existing;
        totalSales += daySales;
        totalProfit += dayProfit;
        totalItems += dayItems;
        mpesaTotal += dayMpesa;
        cashTotal += dayCash;
    }
    const days = Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));
    const commissionInfo = (0, marketingCommission_1.getCommissionSummaryForSales)(totalSales);
    // compute progress to next tier
    const nextTarget = commissionInfo.nextTarget;
    let progressToNextTier = 0;
    if (nextTarget == null) {
        progressToNextTier = 1;
    }
    else {
        const prevTierMin = (commissionCommon_1.COMMISSION_LADDER.filter((t) => t.min <= totalSales).map((t) => t.min).sort((a, b) => b - a)[0]) || 0;
        const denom = Math.max(1, nextTarget - prevTierMin);
        progressToNextTier = Math.max(0, Math.min(1, (totalSales - prevTierMin) / denom));
    }
    return {
        periodFrom: from.toISOString(),
        periodTo: to.toISOString(),
        totalSales: Number(totalSales) || 0,
        totalProfit: Number(totalProfit) || 0,
        totalItems: Number(totalItems) || 0,
        mpesaTotal: Number(mpesaTotal) || 0,
        cashTotal: Number(cashTotal) || 0,
        commissionCumulative: Number(commissionInfo.commission) || 0,
        nextCommissionTier: commissionInfo.nextTarget ?? null,
        progressToNextTier,
        days,
    };
}
