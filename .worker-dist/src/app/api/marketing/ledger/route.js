"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date");
    const impersonateId = url.searchParams.get("impersonateId");
    const actorId = await (0, api_1.getActorId)();
    const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
    if (!targetUserId)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const basisDate = dateStr ? new Date(dateStr) : new Date();
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(basisDate);
    const start = period.start;
    const end = period.end;
    try {
        const ledger = await prisma_1.prisma.commissionLedger.findUnique({
            where: { userId_periodStart_periodEnd: { userId: targetUserId, periodStart: start, periodEnd: end } },
        });
        return server_1.NextResponse.json({ ledger: ledger ?? null });
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Failed to read ledger" }, { status: 500 });
    }
}
