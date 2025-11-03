"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function requireAdmin() {
    var _a;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== "ADMIN") {
        throw new server_1.NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
}
// POST /api/settings/jumia/accounts/[id]/merge
// Reassign all shops from [id] to targetAccountId and optionally delete the source account.
async function POST(request, context) {
    var _a;
    try {
        await requireAdmin();
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    const { params } = context;
    const { id: sourceAccountId } = await params;
    if (!sourceAccountId)
        return server_1.NextResponse.json({ error: "Missing source account id" }, { status: 400 });
    let body;
    try {
        body = (await request.json());
    }
    catch (_b) {
        return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const targetAccountId = (_a = body === null || body === void 0 ? void 0 : body.targetAccountId) === null || _a === void 0 ? void 0 : _a.trim();
    const deleteSource = (body === null || body === void 0 ? void 0 : body.deleteSource) !== false; // default true
    if (!targetAccountId) {
        return server_1.NextResponse.json({ error: "targetAccountId is required" }, { status: 400 });
    }
    if (targetAccountId === sourceAccountId) {
        return server_1.NextResponse.json({ error: "targetAccountId must be different from source account id" }, { status: 400 });
    }
    const [source, target] = await Promise.all([
        prisma_1.prisma.jumiaAccount.findUnique({ where: { id: sourceAccountId } }),
        prisma_1.prisma.jumiaAccount.findUnique({ where: { id: targetAccountId } }),
    ]);
    if (!source)
        return server_1.NextResponse.json({ error: "Source account not found" }, { status: 404 });
    if (!target)
        return server_1.NextResponse.json({ error: "Target account not found" }, { status: 404 });
    // Reassign shops in a transaction
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const moved = await tx.jumiaShop.updateMany({
            where: { accountId: sourceAccountId },
            data: { accountId: targetAccountId },
        });
        if (deleteSource) {
            // Double-check no shops remain, then delete source account
            const remaining = await tx.jumiaShop.count({ where: { accountId: sourceAccountId } });
            if (remaining === 0) {
                await tx.jumiaAccount.delete({ where: { id: sourceAccountId } });
            }
        }
        return { movedCount: moved.count };
    });
    const targetWithShops = await prisma_1.prisma.jumiaAccount.findUnique({
        where: { id: targetAccountId },
        include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    });
    return server_1.NextResponse.json({ ok: true, moved: result.movedCount, target: targetWithShops });
}
