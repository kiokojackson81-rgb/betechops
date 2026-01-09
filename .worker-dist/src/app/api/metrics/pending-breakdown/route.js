"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
async function GET(request) {
    try {
        const url = new URL(request.url);
        const daysParam = Number.parseInt(url.searchParams.get('days') || '7', 10);
        const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;
        const statusesParam = url.searchParams.get('statuses') || url.searchParams.get('status') || 'PENDING,MULTIPLE';
        const statuses = statusesParam.split(',').map(s => s.trim()).filter(Boolean);
        const now = new Date();
        const since = (0, date_fns_tz_1.zonedTimeToUtc)((0, date_fns_1.addDays)(now, -days), 'Africa/Nairobi');
        const baseWhere = {
            status: { in: statuses },
            OR: [
                { updatedAtJumia: { gte: since } },
                { createdAtJumia: { gte: since } },
                { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: since } }] },
            ],
        };
        const [byStatus, byShopPending, multiSample] = await Promise.all([
            // Count by status
            prisma_1.prisma.jumiaOrder.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
            }).catch(() => []),
            // Per-shop PENDING counts
            prisma_1.prisma.jumiaOrder.groupBy({
                by: ['shopId'],
                where: { ...baseWhere, status: { in: ['PENDING'] } },
                _count: { _all: true },
            }).catch(() => []),
            // Sample MULTIPLE rows for audit
            prisma_1.prisma.jumiaOrder.findMany({
                where: { ...baseWhere, status: 'MULTIPLE' },
                orderBy: [{ updatedAtJumia: 'desc' }, { updatedAt: 'desc' }],
                take: 50,
                select: { id: true, shopId: true, status: true, hasMultipleStatus: true, totalItems: true, packedItems: true, createdAtJumia: true, updatedAtJumia: true, updatedAt: true },
            }).catch(() => []),
        ]);
        const payload = {
            ok: true,
            days,
            since,
            statuses,
            countsByStatus: byStatus.map((r) => ({ status: r.status, count: r._count?._all ?? 0 })),
            countsByShopPending: byShopPending.map((r) => ({ shopId: r.shopId, count: r._count?._all ?? 0 })),
            multipleSample: multiSample,
        };
        const res = server_1.NextResponse.json(payload);
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new server_1.NextResponse(msg, { status: 500 });
    }
}
