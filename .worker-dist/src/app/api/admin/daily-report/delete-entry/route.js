"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function POST(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const entryId = body?.entryId;
    if (!entryId || typeof entryId !== "string") {
        return server_1.NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }
    try {
        const before = await prisma_1.prisma.dailyReport.findUnique({
            where: { id: entryId },
            include: { sales: true, user: { select: { id: true, name: true, email: true } } },
        });
        if (!before)
            return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
        const saleIds = before.sales.map((sale) => sale.id);
        if (saleIds.length) {
            await prisma_1.prisma.marketingSale.updateMany({
                where: { dailySaleId: { in: saleIds } },
                data: { dailySaleId: null },
            });
            await prisma_1.prisma.dailySale.deleteMany({ where: { id: { in: saleIds } } });
        }
        await prisma_1.prisma.dailyReport.delete({ where: { id: entryId } });
        try {
            const actorId = await (0, api_1.getActorId)();
            await prisma_1.prisma.actionLog.create({
                data: {
                    actorId: actorId || "",
                    entity: "DailyReport",
                    entityId: entryId,
                    action: "DELETE_ENTRY",
                    before: before,
                    after: { deletedAt: new Date().toISOString() },
                },
            });
        }
        catch (logErr) {
            console.warn("Failed to write actionLog for daily report delete", logErr);
        }
        return server_1.NextResponse.json({ deleted: true });
    }
    catch (err) {
        console.error("Failed to delete daily report entry", err);
        const message = err instanceof Error ? err.message : "Delete failed";
        return server_1.NextResponse.json({ error: message }, { status: 500 });
    }
}
