"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const api_1 = require("@/lib/api");
const marketingCommission_1 = require("@/lib/marketingCommission");
exports.dynamic = "force-dynamic";
const formatLabel = (date) => date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
async function GET(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const dayParam = url.searchParams.get("day");
    const attendantId = url.searchParams.get("attendantId");
    const searchParam = url.searchParams.get("search")?.trim();
    const defaultPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const fromDate = fromParam ? new Date(fromParam) : defaultPeriod.start;
    const toDate = toParam ? new Date(toParam) : defaultPeriod.end;
    const where = {
        date: {
            gte: fromDate,
            lte: toDate,
        },
    };
    if (dayParam) {
        where.dayOfWeek = dayParam;
    }
    if (attendantId) {
        where.submittedById = attendantId;
    }
    if (searchParam) {
        where.OR = [
            { submittedBy: { is: { name: { contains: searchParam, mode: "insensitive" } } } },
            { submittedBy: { is: { email: { contains: searchParam, mode: "insensitive" } } } },
        ];
    }
    const entries = await prisma_1.prisma.supportDailyEntry.findMany({
        where,
        include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            receipts: { include: { items: true } },
        },
        orderBy: { date: "desc" },
    });
    const mapped = entries.map((entry) => {
        const itemsSold = entry.receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
        const performanceEarnings = (entry.newBatteries + entry.changedBatteries) * 70;
        const commission = (0, marketingCommission_1.getCommissionSummaryForSales)(entry.totalSales).commission;
        return {
            id: entry.id,
            date: entry.date.toISOString().split("T")[0],
            dayOfWeek: entry.dayOfWeek,
            attendantId: entry.submittedById,
            attendantName: entry.submittedBy?.name ?? "Unknown",
            attendantEmail: entry.submittedBy?.email ?? null,
            totalSales: entry.totalSales,
            totalProfit: entry.totalProfit,
            itemsSold,
            receipts: entry.receipts.length,
            newBatteries: entry.newBatteries,
            changedBatteries: entry.changedBatteries,
            performanceEarnings,
            commission,
        };
    });
    const summary = mapped.reduce((acc, entry) => {
        acc.periodSales += entry.totalSales;
        acc.itemsSold += entry.itemsSold;
        acc.newBatteries += entry.newBatteries;
        acc.changedBatteries += entry.changedBatteries;
        acc.performanceEarnings += entry.performanceEarnings;
        acc.commission += entry.commission;
        acc.receipts += entry.receipts;
        return acc;
    }, {
        periodSales: 0,
        itemsSold: 0,
        newBatteries: 0,
        changedBatteries: 0,
        performanceEarnings: 0,
        commission: 0,
        receipts: 0,
    });
    const periodLabel = `${formatLabel(fromDate)} – ${formatLabel(toDate)}`;
    return server_1.NextResponse.json({
        periodLabel,
        entries: mapped,
        summary,
    });
}
