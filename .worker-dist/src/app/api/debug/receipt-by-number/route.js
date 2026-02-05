"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    if (!session || !session.user)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const orderNumber = url.searchParams.get("orderNumber");
    if (!orderNumber)
        return server_1.NextResponse.json({ error: "Missing orderNumber" }, { status: 400 });
    // Find receipt and related order/issuedBy info
    const receipt = await prisma_1.prisma.receipt.findFirst({
        where: { order: { orderNumber } },
        include: { order: { select: { id: true, orderNumber: true, attendantId: true } }, issuedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!receipt)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    const orderAttendantId = receipt.order?.attendantId ?? null;
    const issuedById = receipt.issuedBy?.id ?? null;
    const userId = session.user?.id ?? null;
    // Allow if the logged-in user is the order attendant or the issuedBy user
    if (userId !== orderAttendantId && userId !== issuedById) {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const mapped = {
        id: receipt.id,
        orderId: receipt.orderId,
        orderNumber: receipt.order?.orderNumber ?? null,
        issuedById,
        orderAttendantId,
        generatedAt: receipt.generatedAt,
        totals: receipt.totals,
        data: receipt.data ?? null,
    };
    return server_1.NextResponse.json({ receipt: mapped });
}
