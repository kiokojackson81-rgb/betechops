"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("search") || "").trim();
    if (!q)
        return server_1.NextResponse.json([]);
    const products = await prisma_1.prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
            ],
        },
        select: { id: true, name: true, sku: true, sellingPrice: true, lastBuyingPrice: true },
        take: 10,
    }).catch(() => []);
    return server_1.NextResponse.json(products);
}
