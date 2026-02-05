"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
async function POST(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    let payload = null;
    try {
        payload = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!payload?.returnId) {
        return server_1.NextResponse.json({ error: "returnId is required" }, { status: 400 });
    }
    const entry = await prisma_1.prisma.marketplaceReturn.findUnique({
        where: { id: payload.returnId },
    });
    if (!entry) {
        return server_1.NextResponse.json({ error: "Return not found" }, { status: 404 });
    }
    const { accountIds } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    if (!accountIds.includes(entry.accountId) && auth.role !== "ADMIN") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.marketplaceReturn.update({
            where: { id: entry.id },
            data: {
                status: "PICKED",
                processedById: auth.user.id,
                processedAt: new Date(),
                notes: payload?.notes ?? entry.notes,
            },
        });
        if (payload?.attachmentUrl) {
            await tx.marketplaceReturnAttachment.create({
                data: {
                    returnId: entry.id,
                    url: payload.attachmentUrl,
                    uploadedById: auth.user.id,
                },
            });
        }
    });
    return server_1.NextResponse.json({ ok: true });
}
