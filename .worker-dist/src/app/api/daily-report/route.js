"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const toNumberOrNull = (value) => {
    if (value === null || typeof value === "undefined" || value === "")
        return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};
const toIntOrNull = (value) => {
    const num = toNumberOrNull(value);
    return typeof num === "number" ? Math.round(num) : null;
};
// Force this route to be dynamically executed to bypass static caching
exports.dynamic = "force-dynamic";
async function GET(req) {
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const day = url.searchParams.get("day");
    const userQ = url.searchParams.get("user");
    const pageStr = url.searchParams.get("page");
    const pageSizeStr = url.searchParams.get("pageSize");
    const where = {};
    if (fromStr) {
        where.date = { gte: new Date(fromStr) };
    }
    if (toStr) {
        where.date = where.date
            ? { ...where.date, lte: new Date(toStr) }
            : { lte: new Date(toStr) };
    }
    if (day) {
        where.day = day;
    }
    if (userQ) {
        // allow filtering by submittedBy free-text or attendant name/email
        where.OR = [
            { submittedBy: { contains: userQ, mode: "insensitive" } },
            { user: { is: { name: { contains: userQ, mode: "insensitive" } } } },
            { user: { is: { email: { contains: userQ, mode: "insensitive" } } } },
        ];
    }
    try {
        const page = Math.max(1, Number(pageStr || 1));
        const pageSize = Math.max(1, Math.min(1000, Number(pageSizeStr || 25)));
        const skip = (page - 1) * pageSize;
        const [totalCount, reports, agg] = await Promise.all([
            prisma_1.prisma.dailyReport.count({ where }),
            prisma_1.prisma.dailyReport.findMany({
                where,
                include: { user: { select: { id: true, name: true, email: true } }, sales: true },
                orderBy: { date: "desc" },
                skip,
                take: pageSize,
            }),
            prisma_1.prisma.dailyReport.aggregate({
                where,
                _sum: {
                    productsCount: true,
                    totalSales: true,
                    newProducts: true,
                    productsEdited: true,
                    copiesUploaded: true,
                    walkInServed: true,
                    purchasesMade: true,
                    liveSessionsCount: true,
                    commissionEarned: true,
                },
            }),
        ]);
        const summary = {
            totalProducts: agg._sum.productsCount ?? 0,
            totalSales: agg._sum.totalSales ? Number(agg._sum.totalSales) : 0,
            totalNewProducts: agg._sum.newProducts ?? 0,
            totalProductsEdited: agg._sum.productsEdited ?? 0,
            totalCopiesUploaded: agg._sum.copiesUploaded ?? 0,
            totalWalkInsServed: agg._sum.walkInServed ?? 0,
            totalPurchasesMade: agg._sum.purchasesMade ?? 0,
            totalLiveSessions: agg._sum.liveSessionsCount ?? 0,
            totalCommissionEarned: agg._sum.commissionEarned ? Number(agg._sum.commissionEarned) : 0,
        };
        return server_1.NextResponse.json({ reports, summary, totalCount });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e ?? "Server error");
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
async function POST(req) {
    const auth = await (0, api_1.requireRole)("ATTENDANT");
    if (!auth.ok)
        return auth.res;
    const actorId = await (0, api_1.getActorId)();
    if (!actorId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { date, day, productsCount, totalSales, tasks, submittedBy, 
        // new fields
        newProducts, productsEdited, copiesUploaded, walkInServed, purchasesMade, liveSessionsCount, commissionEarned, confirmedCompetitiveness, marketEngagement, concerns, } = await req.json();
        if (!day) {
            return server_1.NextResponse.json({ error: "day is required" }, { status: 400 });
        }
        const normalizedMetrics = {
            newProducts: toIntOrNull(newProducts),
            productsEdited: toIntOrNull(productsEdited),
            copiesUploaded: toIntOrNull(copiesUploaded),
            walkInServed: toIntOrNull(walkInServed),
            purchasesMade: toIntOrNull(purchasesMade),
            liveSessionsCount: toIntOrNull(liveSessionsCount),
            commissionEarned: toNumberOrNull(commissionEarned),
            confirmedCompetitiveness: typeof confirmedCompetitiveness === "boolean"
                ? confirmedCompetitiveness
                : confirmedCompetitiveness == null
                    ? null
                    : Boolean(confirmedCompetitiveness),
            marketEngagement: marketEngagement && typeof marketEngagement === "object" ? marketEngagement : null,
            concerns: typeof concerns === "string" ? concerns : null,
        };
        // merge submittedBy into tasks for backward compatibility
        // Also embed the new metrics inside the tasks JSON so reports are preserved
        // even when the database schema migration has not yet been applied.
        const metricsPayload = {
            newProducts: typeof normalizedMetrics.newProducts === "number" ? normalizedMetrics.newProducts : undefined,
            productsEdited: typeof normalizedMetrics.productsEdited === "number" ? normalizedMetrics.productsEdited : undefined,
            copiesUploaded: typeof normalizedMetrics.copiesUploaded === "number" ? normalizedMetrics.copiesUploaded : undefined,
            walkInServed: typeof normalizedMetrics.walkInServed === "number" ? normalizedMetrics.walkInServed : undefined,
            purchasesMade: typeof normalizedMetrics.purchasesMade === "number" ? normalizedMetrics.purchasesMade : undefined,
            liveSessionsCount: typeof normalizedMetrics.liveSessionsCount === "number" ? normalizedMetrics.liveSessionsCount : undefined,
            commissionEarned: typeof normalizedMetrics.commissionEarned === "number" ? normalizedMetrics.commissionEarned : undefined,
            confirmedCompetitiveness: typeof normalizedMetrics.confirmedCompetitiveness === "boolean" ? normalizedMetrics.confirmedCompetitiveness : undefined,
            marketEngagement: normalizedMetrics.marketEngagement ?? undefined,
            concerns: normalizedMetrics.concerns ?? undefined,
        };
        const tasksWithSubmit = {
            ...(tasks || {}),
            ...(submittedBy ? { submittedBy } : {}),
            metrics: { ...(tasks?.metrics || {}), ...metricsPayload },
        };
        const reportDate = date ? new Date(date) : new Date();
        const dayStart = new Date(reportDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const taskSales = Array.isArray(tasks?.sales) ? tasks?.sales : [];
        const derivedProfit = toNumberOrNull(tasks?.metrics?.totalProfit) ??
            toNumberOrNull(tasks?.totals?.profit) ??
            toNumberOrNull(totalSales) ??
            0;
        const totalProfitForDay = typeof derivedProfit === "number" ? derivedProfit : 0;
        if (!tasksWithSubmit.metrics)
            tasksWithSubmit.metrics = {};
        tasksWithSubmit.metrics.totalProfit = totalProfitForDay;
        const reportPayload = {
            date: reportDate,
            day: String(day),
            productsCount: Number(productsCount) || 0,
            totalSales: Number(totalSales) || 0,
            tasks: tasksWithSubmit,
            submittedBy: submittedBy || null,
            userId: actorId || undefined,
            ...(typeof normalizedMetrics.newProducts === "number" ? { newProducts: normalizedMetrics.newProducts } : {}),
            ...(typeof normalizedMetrics.productsEdited === "number" ? { productsEdited: normalizedMetrics.productsEdited } : {}),
            ...(typeof normalizedMetrics.copiesUploaded === "number" ? { copiesUploaded: normalizedMetrics.copiesUploaded } : {}),
            ...(typeof normalizedMetrics.walkInServed === "number" ? { walkInServed: normalizedMetrics.walkInServed } : {}),
            ...(typeof normalizedMetrics.purchasesMade === "number" ? { purchasesMade: normalizedMetrics.purchasesMade } : {}),
            ...(typeof normalizedMetrics.liveSessionsCount === "number" ? { liveSessionsCount: normalizedMetrics.liveSessionsCount } : {}),
            ...(typeof normalizedMetrics.commissionEarned === "number" ? { commissionEarned: normalizedMetrics.commissionEarned } : {}),
            ...(typeof normalizedMetrics.confirmedCompetitiveness === "boolean"
                ? { confirmedCompetitiveness: normalizedMetrics.confirmedCompetitiveness }
                : {}),
            ...(normalizedMetrics.marketEngagement ? { marketEngagement: normalizedMetrics.marketEngagement } : {}),
            ...(normalizedMetrics.concerns ? { concerns: normalizedMetrics.concerns } : {}),
        };
        let savedReport;
        let periodCommission = 0;
        let periodTotals = null;
        await prisma_1.prisma.$transaction(async (tx) => {
            const existing = await tx.dailyReport.findFirst({
                where: {
                    userId: actorId || undefined,
                    date: { gte: dayStart, lt: dayEnd },
                },
            });
            if (existing) {
                await tx.dailySale.deleteMany({ where: { dailyReportId: existing.id } });
                savedReport = await tx.dailyReport.update({
                    where: { id: existing.id },
                    data: reportPayload,
                });
            }
            else {
                savedReport = await tx.dailyReport.create({ data: reportPayload });
            }
            if (taskSales.length > 0) {
                const createMany = taskSales.map((s) => ({
                    dailyReportId: savedReport.id,
                    productName: s.productName || "",
                    price: Number(s.price || 0),
                    paymentMethod: s.paymentMethod || undefined,
                    receiptNumber: s.receiptNumber || undefined,
                }));
                await tx.dailySale.createMany({ data: createMany });
            }
            const period = (0, tradingPeriod_1.getTradingPeriodFor)(reportDate);
            const ledgerResult = await (0, marketingPeriodTotals_1.recomputeMarketingCommissionLedger)({
                userId: actorId,
                period,
                client: tx,
            });
            periodCommission = ledgerResult.commission;
            periodTotals = ledgerResult.totals;
        });
        return server_1.NextResponse.json({
            report: savedReport,
            commission: periodCommission,
            periodTotals,
        }, { status: 201 });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e ?? "Server error");
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
