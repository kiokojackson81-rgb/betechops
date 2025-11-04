"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function GET(req) {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || 20)));
    const where = { status: { in: ["PENDING", "PROCESSING"] } };
    if (q) {
        where.OR = [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { shop: { name: { contains: q, mode: "insensitive" } } },
        ];
    }
    const rowsRaw = await prisma_1.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        include: {
            shop: { select: { name: true } },
            items: { include: { product: { select: { lastBuyingPrice: true, sellingPrice: true } } } },
        },
    });
    const rows = rowsRaw.map((o) => {
        const itemsCount = (o.items || []).reduce((acc, x) => acc + (x.quantity ?? 0), 0);
        const sellingTotal = (o.items || []).reduce((acc, x) => {
            const sp = (x.sellingPrice ?? x.product?.sellingPrice ?? 0) * (x.quantity ?? 0);
            return acc + sp;
        }, 0);
        const hasBuyingPrice = (o.items || []).every((x) => typeof x.product?.lastBuyingPrice === "number");
        return {
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName ?? null,
            itemsCount,
            sellingTotal,
            hasBuyingPrice,
            paymentStatus: o.paymentStatus,
            createdAt: o.createdAt.toISOString(),
        };
    });
    return server_1.NextResponse.json(rows);
}
