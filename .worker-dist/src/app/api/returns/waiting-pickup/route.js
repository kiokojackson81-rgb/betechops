"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET() {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const count = await prisma_1.prisma.returnCase.count({
            where: {
                status: "pickup_scheduled",
                OR: [
                    { updatedAt: { gte: sevenDaysAgo } },
                    { createdAt: { gte: sevenDaysAgo } },
                ],
            },
        });
        return server_1.NextResponse.json({ count, window: { from: sevenDaysAgo.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ count: 0, error: msg }, { status: 200 });
    }
}
