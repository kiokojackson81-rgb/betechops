"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const guard = await (0, auth_1.requireAttendant)(req, ["ATTENDANT", "SUPERVISOR", "ADMIN"]);
    if (!guard.ok)
        return guard.res;
    const url = new URL(req.url);
    const weekStart = url.searchParams.get("weekStart") || undefined;
    const weekEnd = url.searchParams.get("weekEnd") || undefined;
    const baseWhere = {
        userId: guard.user.id,
    };
    const periodWhere = { ...baseWhere };
    if (weekStart || weekEnd) {
        const range = {};
        if (weekStart) {
            const startDate = new Date(weekStart);
            if (!Number.isNaN(startDate.valueOf())) {
                range.gte = startDate;
            }
        }
        if (weekEnd) {
            const endDate = new Date(weekEnd);
            if (!Number.isNaN(endDate.valueOf())) {
                range.lte = endDate;
            }
        }
        if (Object.keys(range).length > 0) {
            periodWhere.weekStart = range;
        }
    }
    const [entries, periodAggregate, totalAggregate] = await Promise.all([
        prisma_1.prisma.weeklySale.findMany({
            where: periodWhere,
            include: {
                shop: { select: { id: true, name: true, platform: true } },
            },
            orderBy: { weekStart: "desc" },
        }),
        prisma_1.prisma.weeklySale.aggregate({
            where: periodWhere,
            _sum: { amount: true },
        }),
        prisma_1.prisma.weeklySale.aggregate({
            where: baseWhere,
            _sum: { amount: true },
        }),
    ]);
    const periodTotal = Number(periodAggregate._sum.amount ?? 0);
    const totalToDate = Number(totalAggregate._sum.amount ?? 0);
    return server_1.NextResponse.json({
        entries: entries.map((entry) => ({
            id: entry.id,
            shopId: entry.shopId,
            amount: Number(entry.amount ?? 0),
            weekStart: entry.weekStart.toISOString(),
            weekEnd: entry.weekEnd.toISOString(),
            platform: entry.platform,
            status: entry.status,
            shop: entry.shop,
        })),
        periodTotal,
        totalToDate,
        weekStart,
        weekEnd,
    });
}
