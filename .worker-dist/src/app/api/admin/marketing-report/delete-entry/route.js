"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
async function POST(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    let body;
    try {
        body = await req.json();
    }
    catch (err) {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const entryId = body?.entryId;
    if (!entryId)
        return server_1.NextResponse.json({ error: "entryId is required" }, { status: 400 });
    try {
        const before = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
        if (!before)
            return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
        // delete items, receipts, then entry
        // Use relation filter to target items whose receipt belongs to this entry
        await prisma_1.prisma.marketingReceiptItem.deleteMany({ where: { receipt: { is: { dailyEntryId: entryId } } } });
        await prisma_1.prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: entryId } });
        await prisma_1.prisma.marketingDailyEntry.delete({ where: { id: entryId } });
        // audit
        try {
            const actorId = await (0, api_1.getActorId)();
            const session = await (0, auth_1.auth)();
            const actorEmail = session?.user?.email || "";
            const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
            await prisma_1.prisma.actionLog.create({
                data: {
                    actorId: actorId || "",
                    entity: "MarketingDailyEntry",
                    entityId: entryId,
                    action: "DELETE_ENTRY",
                    before: before,
                    after: { actorEmail, ip },
                },
            });
        }
        catch (e) {
            console.warn("failed to write actionLog for marketing delete", e);
        }
        return server_1.NextResponse.json({ deleted: true }, { status: 200 });
    }
    catch (err) {
        console.error("delete entry failed", err);
        return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
    }
}
