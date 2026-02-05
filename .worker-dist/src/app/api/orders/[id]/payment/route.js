"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const client_1 = require("@prisma/client");
async function POST(_, { params }) {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id)
        return server_1.NextResponse.json({ error: "Missing id" }, { status: 400 });
    const order = await prisma_1.prisma.order.findUnique({ where: { id }, select: { id: true, totalAmount: true, items: true } }).catch(() => null);
    if (!order)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    const computedTotal = order.items?.reduce((acc, x) => acc + (x.sellingPrice ?? 0) * (x.quantity ?? 0), 0) ?? 0;
    const total = (order.totalAmount ?? 0) > 0 ? order.totalAmount : computedTotal;
    try {
        await prisma_1.prisma.order.update({ where: { id }, data: { paidAmount: total, paymentStatus: client_1.PaymentStatus.PAID, status: client_1.OrderStatus.PROCESSING } });
    }
    catch {
        // swallow update errors; this endpoint is best-effort
    }
    return server_1.NextResponse.json({ ok: true });
}
