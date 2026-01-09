"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const onlineCommission_1 = require("@/lib/onlineCommission");
const client_1 = require("@prisma/client");
const resolveTargetUser_1 = require("@/lib/resolveTargetUser");
exports.dynamic = "force-dynamic";
const parseDateParam = (value) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const identity = await (0, resolveTargetUser_1.resolveTargetUserId)(req);
    const meta = identity;
    const attendantId = identity.resolvedUserId;
    if (!attendantId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const startParam = parseDateParam(url.searchParams.get("start"));
    const endParam = parseDateParam(url.searchParams.get("end"));
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const start = startParam ?? period.start;
    const end = endParam ?? period.end;
    // marketplace totals from approved weeklySale manual/approved entries
    const entries = await prisma_1.prisma.weeklySale.findMany({
        where: {
            userId: attendantId,
            status: client_1.WeeklySaleStatus.APPROVED,
            AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
        },
        select: { platform: true, amount: true },
    });
    const marketplaceTotals = entries.reduce((acc, e) => {
        const value = Number(e.amount ?? 0);
        if (e.platform === "JUMIA")
            acc.jumia += value;
        if (e.platform === "KILIMALL")
            acc.kilimall += value;
        return acc;
    }, { jumia: 0, kilimall: 0 });
    // direct sales from supportDailyEntry
    const directEntries = await prisma_1.prisma.supportDailyEntry.findMany({
        where: { submittedById: attendantId, date: { gte: start, lte: end } },
        select: { totalSales: true, totalProfit: true },
    });
    const directTotals = directEntries.reduce((acc, e) => {
        acc.sales += Number(e.totalSales ?? 0);
        acc.profit += Number(e.totalProfit ?? 0);
        return acc;
    }, { sales: 0, profit: 0 });
    const periodInputs = {
        attendantId,
        periodStart: start,
        periodEnd: end,
        directSales: directTotals.sales,
        directProfit: directTotals.profit,
        jumiaSales: marketplaceTotals.jumia,
        kilimallSales: marketplaceTotals.kilimall,
    };
    const result = (0, onlineCommission_1.computeOnlinePeriodCommission)(periodInputs);
    return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, result));
}
