"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const client_1 = require("@prisma/client");
async function POST(_, { params }) {
    var _a, _b, _c, _d;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id)
        return server_1.NextResponse.json({ error: "Missing id" }, { status: 400 });
    const order = await prisma_1.prisma.order.findUnique({ where: { id }, select: { id: true, totalAmount: true, items: true } }).catch(() => null);
    if (!order)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    const computedTotal = (_c = (_b = order.items) === null || _b === void 0 ? void 0 : _b.reduce((acc, x) => { var _a, _b; return acc + ((_a = x.sellingPrice) !== null && _a !== void 0 ? _a : 0) * ((_b = x.quantity) !== null && _b !== void 0 ? _b : 0); }, 0)) !== null && _c !== void 0 ? _c : 0;
    const total = ((_d = order.totalAmount) !== null && _d !== void 0 ? _d : 0) > 0 ? order.totalAmount : computedTotal;
    try {
        await prisma_1.prisma.order.update({ where: { id }, data: { paidAmount: total, paymentStatus: client_1.PaymentStatus.PAID, status: client_1.OrderStatus.PROCESSING } });
    }
    catch (_e) {
        // swallow update errors; this endpoint is best-effort
    }
    return server_1.NextResponse.json({ ok: true });
}
