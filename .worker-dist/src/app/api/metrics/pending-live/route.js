"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    var _a, _b, _c;
    const url = new URL(request.url);
    const windowDays = Math.max(1, Number((_a = url.searchParams.get('days')) !== null && _a !== void 0 ? _a : 7));
    const timeoutMs = Math.max(500, Number((_b = url.searchParams.get('timeoutMs')) !== null && _b !== void 0 ? _b : 2500));
    const pageSize = Math.min(200, Math.max(1, Number((_c = url.searchParams.get('size')) !== null && _c !== void 0 ? _c : 100)));
    const started = Date.now();
    const deadline = started + timeoutMs;
    // Discover shops known locally
    const shops = await prisma_1.prisma.jumiaShop.findMany({ select: { id: true } });
    const perShop = [];
    for (const s of shops) {
        if (Date.now() >= deadline)
            break;
        const shopId = s.id;
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const baseParams = { status: 'PENDING', size: String(pageSize) };
        let token = null;
        let pages = 0;
        let count = 0;
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth ? { shopAuth } : {});
        try {
            do {
                if (Date.now() >= deadline)
                    break;
                const params = new URLSearchParams(baseParams);
                if (token)
                    params.set('token', token);
                const q = params.toString();
                const page = await fetcher(`/orders${q ? `?${q}` : ''}`);
                const arr = Array.isArray(page === null || page === void 0 ? void 0 : page.orders)
                    ? page.orders
                    : Array.isArray(page === null || page === void 0 ? void 0 : page.items)
                        ? page.items
                        : Array.isArray(page === null || page === void 0 ? void 0 : page.data)
                            ? page.data
                            : [];
                count += arr.length;
                token = ((page === null || page === void 0 ? void 0 : page.nextToken) ? String(page.nextToken) : '') || null;
                pages += 1;
                if ((page === null || page === void 0 ? void 0 : page.isLastPage) === true)
                    break;
            } while (token && pages < 2000);
        }
        catch (_d) {
            // ignore errors per shop; continue
        }
        perShop.push({ shopId, count, pages });
    }
    const total = perShop.reduce((acc, r) => acc + r.count, 0);
    const res = server_1.NextResponse.json({ ok: true, total, perShop, shops: shops.length, tookMs: Date.now() - started });
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
