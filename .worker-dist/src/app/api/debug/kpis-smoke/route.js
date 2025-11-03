"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const abs_url_1 = require("@/lib/abs-url");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    var _a;
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // 1) DB-based 7-day pending count (same logic used by KPIs route)
        const queuedDb = await prisma_1.prisma.jumiaOrder.count({
            where: {
                status: { in: ['PENDING', 'MULTIPLE'] },
                OR: [
                    { updatedAtJumia: { gte: sevenDaysAgo } },
                    { createdAtJumia: { gte: sevenDaysAgo } },
                    {
                        AND: [
                            { updatedAtJumia: null },
                            { createdAtJumia: null },
                            { updatedAt: { gte: sevenDaysAgo } },
                        ],
                    },
                ],
            },
        });
        // 2) Small sample of orders to verify presence visually
        const sample = await prisma_1.prisma.jumiaOrder.findMany({
            where: {
                status: { in: ['PENDING', 'MULTIPLE'] },
                OR: [
                    { updatedAtJumia: { gte: sevenDaysAgo } },
                    { createdAtJumia: { gte: sevenDaysAgo } },
                    {
                        AND: [
                            { updatedAtJumia: null },
                            { createdAtJumia: null },
                            { updatedAt: { gte: sevenDaysAgo } },
                        ],
                    },
                ],
            },
            // JumiaOrder doesn't have orderId; it uses id (string) and optional numeric number
            select: { id: true, number: true, status: true, createdAtJumia: true, updatedAtJumia: true, shopId: true },
            take: 5,
            orderBy: { updatedAtJumia: 'desc' },
        });
        // 3) Compare with the KPI endpoint (DB-only mode to avoid live boost)
        const url = await (0, abs_url_1.absUrl)('/api/metrics/kpis?noLive=1');
        const resp = await fetch(url, { cache: 'no-store' });
        const routeJson = resp.ok ? await resp.json() : null;
        const pendingAll = typeof (routeJson === null || routeJson === void 0 ? void 0 : routeJson.pendingAll) === 'number' ? Number(routeJson.pendingAll) : null;
        const out = {
            ok: true,
            now: now.toISOString(),
            windowStart: sevenDaysAgo.toISOString(),
            queuedDb,
            kpisRoute: { status: resp.status, pendingAll, approx: Boolean(routeJson === null || routeJson === void 0 ? void 0 : routeJson.approx), updatedAt: (_a = routeJson === null || routeJson === void 0 ? void 0 : routeJson.updatedAt) !== null && _a !== void 0 ? _a : null },
            equal: pendingAll === null ? null : queuedDb === pendingAll,
            sample,
        };
        const res = server_1.NextResponse.json(out);
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new server_1.NextResponse(msg, { status: 500 });
    }
}
