"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET() {
    try {
        // Aggregate directly from the synced database so UI counts stay stable across refreshes.
        const now = new Date();
        const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const total = await prisma_1.prisma.order.count({
            where: {
                status: "PENDING",
                updatedAt: {
                    gte: windowStart,
                    lte: now,
                },
                shop: {
                    isActive: true,
                },
            },
        });
        const res = server_1.NextResponse.json({
            count: total,
            window: {
                from: windowStart.toISOString(),
                to: now.toISOString(),
            },
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const res = server_1.NextResponse.json({ count: 0, error: msg }, { status: 200 });
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
}
