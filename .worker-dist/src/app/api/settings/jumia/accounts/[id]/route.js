"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function requireAdmin() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN") {
        throw new server_1.NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
}
// DELETE /api/settings/jumia/accounts/[id]
// Safely delete a Jumia account. Will only delete if the account has zero shops.
// If the account still has shops, returns 400 advising to merge/transfer first.
async function DELETE(_request, context) {
    try {
        await requireAdmin();
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    const { params } = context;
    const { id } = await params;
    if (!id)
        return server_1.NextResponse.json({ error: "Missing account id" }, { status: 400 });
    const account = await prisma_1.prisma.jumiaAccount.findUnique({ where: { id } });
    if (!account)
        return server_1.NextResponse.json({ error: "Account not found" }, { status: 404 });
    const shopsCount = await prisma_1.prisma.jumiaShop.count({ where: { accountId: id } });
    if (shopsCount > 0) {
        return server_1.NextResponse.json({
            error: "Account has linked shops. Transfer shops to another account before deleting.",
            shopsCount,
        }, { status: 400 });
    }
    await prisma_1.prisma.jumiaAccount.delete({ where: { id } });
    return server_1.NextResponse.json({ ok: true });
}
