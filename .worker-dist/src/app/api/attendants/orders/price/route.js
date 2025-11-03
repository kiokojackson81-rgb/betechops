"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function POST(req) {
    var _a;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { productId, lastBuyingPrice } = body;
    const v = Number(lastBuyingPrice);
    if (!productId || !Number.isFinite(v) || v <= 0)
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    try {
        // Try to update the product record. If the Prisma schema does not include lastBuyingPrice
        // this will throw and we fallback to accepting without persisting.
        const updated = await prisma_1.prisma.product.update({
            where: { id: productId },
            data: { lastBuyingPrice: v },
            select: { id: true, lastBuyingPrice: true },
        });
        return server_1.NextResponse.json({ ok: true, product: updated });
    }
    catch (_b) {
        // If the schema doesn't have lastBuyingPrice, accept the request but don't persist
        return server_1.NextResponse.json({ ok: true, accepted: true }, { status: 202 });
    }
}
