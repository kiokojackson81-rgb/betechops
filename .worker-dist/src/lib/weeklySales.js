"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeWeeklySalesForPeriod = summarizeWeeklySalesForPeriod;
exports.recomputeWeeklySalesCommission = recomputeWeeklySalesCommission;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const commission_1 = require("@/lib/commission");
const onlineCommission_1 = require("@/lib/onlineCommission");
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
async function summarizeWeeklySalesForPeriod(opts) {
    const { userId, period } = opts;
    const client = opts.client ?? prisma_1.prisma;
    let rows = [];
    try {
        rows = await client.weeklySale.findMany({
            where: {
                userId,
                status: client_1.WeeklySaleStatus.APPROVED,
                AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
            },
            select: { amount: true },
        });
    }
    catch (e) {
        // If the WeeklySale table does not exist in the connected database (Prisma P2021),
        // return an empty summary rather than letting the entire request fail.
        if (e?.code === "P2021") {
            console.warn("[weeklySales] weeklySale table not found; returning zero summary", e.message || e);
            return { totalSales: 0, entries: 0 };
        }
        throw e;
    }
    if (!rows.length) {
        return { totalSales: 0, entries: 0 };
    }
    const totalSales = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return { totalSales, entries: rows.length };
}
async function recomputeWeeklySalesCommission(opts) {
    const { userId } = opts;
    if (!userId) {
        return { updated: false, totalSales: 0, payout: 0, period: opts.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date()), ledgerId: null };
    }
    const client = opts.client ?? prisma_1.prisma;
    const period = opts.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const summary = await summarizeWeeklySalesForPeriod({ userId, period, client });
    if (!summary.entries || summary.totalSales <= 0) {
        return {
            updated: false,
            totalSales: summary.totalSales,
            payout: 0,
            period,
            ledgerId: null,
        };
    }
    const { period: commissionPeriod, tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(period.start);
    const marketplaceTotals = await getMarketplaceTotals(userId, period, client);
    const directTotals = await getDirectSalesTotals(userId, period, client);
    const periodInputs = {
        attendantId: userId,
        periodStart: period.start,
        periodEnd: period.end,
        directSales: directTotals.sales,
        directProfit: directTotals.profit,
        jumiaSales: marketplaceTotals.jumia,
        kilimallSales: marketplaceTotals.kilimall,
    };
    const periodCommission = (0, onlineCommission_1.computeOnlinePeriodCommission)(periodInputs);
    const payout = periodCommission.totalCommission;
    const existingCommission = await client.attendantCommission.findFirst({
        where: { userId, periodId: commissionPeriod.id, shopId: null },
    });
    if (existingCommission) {
        await client.attendantCommission.update({
            where: { id: existingCommission.id },
            data: { sales: summary.totalSales, payout },
        });
    }
    else {
        await client.attendantCommission.create({
            data: {
                userId,
                periodId: commissionPeriod.id,
                shopId: null,
                sales: summary.totalSales,
                payout,
            },
        });
    }
    const existingLedger = await client.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
    });
    const detailValue = existingLedger?.detail;
    const nextDetail = isRecord(detailValue) ? { ...detailValue } : {};
    const prevOnlineRaw = nextDetail.onlineCommission;
    const previousOnline = isRecord(prevOnlineRaw) ? prevOnlineRaw : null;
    const previousTotal = typeof previousOnline?.totalCommission === "number"
        ? previousOnline.totalCommission
        : Number(nextDetail.onlineCommissionTotal ?? 0);
    const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousTotal ?? 0));
    const grossCommission = baseGross + payout;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;
    nextDetail.onlineWeekly = {
        periodKey: period.key,
        totals: summary,
        commission: payout,
        computedAt: new Date().toISOString(),
    };
    nextDetail.onlineWeeklyCommission = payout;
    nextDetail.onlineCommission = {
        periodKey: period.key,
        direct: periodCommission.lines.find((line) => line.channel === "DIRECT"),
        jumia: periodCommission.lines.find((line) => line.channel === "JUMIA"),
        kilimall: periodCommission.lines.find((line) => line.channel === "KILIMALL"),
        lines: periodCommission.lines,
        totalCommission: payout,
        computedAt: new Date().toISOString(),
    };
    nextDetail.onlineCommissionTotal = payout;
    const directLine = periodCommission.lines.find((line) => line.channel === "DIRECT") ?? {
        channel: "DIRECT",
        sales: 0,
        profit: 0,
        commission: 0,
        mode: "none",
    };
    const jumiaLine = periodCommission.lines.find((line) => line.channel === "JUMIA") ?? {
        channel: "JUMIA",
        sales: 0,
        commission: 0,
        mode: "none",
    };
    const kilimallLine = periodCommission.lines.find((line) => line.channel === "KILIMALL") ?? {
        channel: "KILIMALL",
        sales: 0,
        commission: 0,
        mode: "none",
    };
    const breakdown = periodCommission.lines.map((line) => ({
        channel: line.channel,
        sales: line.sales,
        profit: line.profit ?? null,
        commission: line.commission,
        mode: line.mode,
        reason: line.reason ?? null,
    }));
    const ledger = await client.commissionLedger.upsert({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
        update: {
            grossCommission: grossCommission.toString(),
            netCommission: netCommission.toString(),
            commissionDirect: directLine.commission.toString(),
            commissionMarketplaceJumia: jumiaLine.commission.toString(),
            commissionMarketplaceKilimall: kilimallLine.commission.toString(),
            commissionTotal: periodCommission.totalCommission.toString(),
            commissionBreakdown: breakdown,
            detail: nextDetail,
        },
        create: {
            userId,
            periodStart: period.start,
            periodEnd: period.end,
            grossCommission: grossCommission.toString(),
            netCommission: netCommission.toString(),
            commissionDirect: directLine.commission.toString(),
            commissionMarketplaceJumia: jumiaLine.commission.toString(),
            commissionMarketplaceKilimall: kilimallLine.commission.toString(),
            commissionTotal: periodCommission.totalCommission.toString(),
            commissionBreakdown: breakdown,
            detail: nextDetail,
        },
    });
    return {
        updated: true,
        totalSales: summary.totalSales,
        payout,
        period,
        ledgerId: ledger.id,
    };
}
async function getMarketplaceTotals(userId, period, client) {
    const entries = await client.weeklySale.findMany({
        where: {
            userId,
            status: client_1.WeeklySaleStatus.APPROVED,
            AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
        },
        select: { platform: true, amount: true },
    });
    return entries.reduce((acc, entry) => {
        const value = Number(entry.amount ?? 0);
        if (entry.platform === "JUMIA") {
            acc.jumia += value;
        }
        else if (entry.platform === "KILIMALL") {
            acc.kilimall += value;
        }
        return acc;
    }, { jumia: 0, kilimall: 0 });
}
async function getDirectSalesTotals(userId, period, client) {
    const entries = await client.supportDailyEntry.findMany({
        where: {
            submittedById: userId,
            date: { gte: period.start, lte: period.end },
        },
        select: {
            totalSales: true,
            totalProfit: true,
        },
    });
    return entries.reduce((acc, entry) => {
        acc.sales += Number(entry.totalSales ?? 0);
        acc.profit += Number(entry.totalProfit ?? 0);
        return acc;
    }, { sales: 0, profit: 0 });
}
