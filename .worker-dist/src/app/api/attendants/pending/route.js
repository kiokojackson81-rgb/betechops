"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function GET(req) {
    var _a;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
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
        var _a;
        const itemsCount = (o.items || []).reduce((acc, x) => { var _a; return acc + ((_a = x.quantity) !== null && _a !== void 0 ? _a : 0); }, 0);
        const sellingTotal = (o.items || []).reduce((acc, x) => {
            var _a, _b, _c, _d;
            const sp = ((_c = (_a = x.sellingPrice) !== null && _a !== void 0 ? _a : (_b = x.product) === null || _b === void 0 ? void 0 : _b.sellingPrice) !== null && _c !== void 0 ? _c : 0) * ((_d = x.quantity) !== null && _d !== void 0 ? _d : 0);
            return acc + sp;
        }, 0);
        const hasBuyingPrice = (o.items || []).every((x) => { var _a; return typeof ((_a = x.product) === null || _a === void 0 ? void 0 : _a.lastBuyingPrice) === "number"; });
        return {
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: (_a = o.customerName) !== null && _a !== void 0 ? _a : null,
            itemsCount,
            sellingTotal,
            hasBuyingPrice,
            paymentStatus: o.paymentStatus,
            createdAt: o.createdAt.toISOString(),
        };
    });
    return server_1.NextResponse.json(rows);
}
