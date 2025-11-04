"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    const url = new URL(request.url);
    const windowDays = Math.max(1, Number(url.searchParams.get('days') ?? 7));
    const timeoutMs = Math.max(500, Number(url.searchParams.get('timeoutMs') ?? 2500));
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('size') ?? 100)));
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
                const arr = Array.isArray(page?.orders)
                    ? page.orders
                    : Array.isArray(page?.items)
                        ? page.items
                        : Array.isArray(page?.data)
                            ? page.data
                            : [];
                count += arr.length;
                token = (page?.nextToken ? String(page.nextToken) : '') || null;
                pages += 1;
                if (page?.isLastPage === true)
                    break;
            } while (token && pages < 2000);
        }
        catch {
            // ignore errors per shop; continue
        }
        perShop.push({ shopId, count, pages });
    }
    const total = perShop.reduce((acc, r) => acc + r.count, 0);
    const res = server_1.NextResponse.json({ ok: true, total, perShop, shops: shops.length, tookMs: Date.now() - started });
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
