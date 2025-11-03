"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const client_1 = require("@prisma/client");
async function POST(_, { params }) {
    var _a;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id)
        return server_1.NextResponse.json({ error: "Missing id" }, { status: 400 });
    const data = { status: client_1.OrderStatus.FULFILLED };
    try {
        await prisma_1.prisma.order.update({ where: { id }, data });
    }
    catch (_b) {
        // fallback to COMPLETED if FULFILLED update fails
        await prisma_1.prisma.order.update({ where: { id }, data: { status: client_1.OrderStatus.COMPLETED } }).catch(() => null);
    }
    return server_1.NextResponse.json({ ok: true });
}
