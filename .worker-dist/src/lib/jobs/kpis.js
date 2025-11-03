"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateKpisCache = updateKpisCache;
exports.updateKpisCacheExact = updateKpisCacheExact;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
const kpisCache_1 = require("@/lib/kpisCache");
const abs_url_1 = require("@/lib/abs-url");
async function updateKpisCache() {
    const shops = await prisma_1.prisma.shop.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true } });
    const perShop = await Promise.all(shops.map(async (s) => ({
        prod: await (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId: s.id, limitPages: 6, size: 100, timeMs: 15000 }).catch(() => ({ total: 0, approx: true })),
        pend: await (0, jumia_1.getPendingOrdersCountQuickForShop)({ shopId: s.id, limitPages: 6, size: 50, timeMs: 10000 }).catch(() => ({ total: 0, approx: true })),
    })));
    const productsAll = perShop.reduce((n, s) => { var _a; return n + (((_a = s.prod) === null || _a === void 0 ? void 0 : _a.total) || 0); }, 0);
    const pendingAll = perShop.reduce((n, s) => { var _a; return n + (((_a = s.pend) === null || _a === void 0 ? void 0 : _a.total) || 0); }, 0);
    const approx = perShop.some((s) => { var _a, _b; return ((_a = s.prod) === null || _a === void 0 ? void 0 : _a.approx) || ((_b = s.pend) === null || _b === void 0 ? void 0 : _b.approx); });
    const payload = { productsAll, pendingAll, approx, updatedAt: Date.now() };
    await (0, kpisCache_1.writeKpisCache)(payload);
    return payload;
}
async function updateKpisCacheExact() {
    const shops = await prisma_1.prisma.shop.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true } });
    // Use master-account all-shops exact counter for products to avoid 14x fan-out
    const prodAll = await (0, jumia_1.getCatalogProductsCountExactAll)({ size: 100, timeMs: 55000 }).catch(() => ({ total: 0, approx: true }));
    // Pending orders: prefer a true cross-shop aggregation through our internal ALL-shops Orders API
    // This avoids requiring per-shop credentials and reflects the live vendor state.
    let pendingAll = 0;
    let pendingApprox = false;
    try {
        // Walk through all pages of /api/orders?status=PENDING&shopId=ALL
        let token = null;
        do {
            const base = `/api/orders?status=PENDING&shopId=ALL&size=100${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
            const url = await (0, abs_url_1.absUrl)(base);
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok)
                throw new Error(`orders ALL failed: ${res.status}`);
            const j = await res.json();
            const arr = Array.isArray(j === null || j === void 0 ? void 0 : j.orders)
                ? j.orders
                : Array.isArray(j === null || j === void 0 ? void 0 : j.items)
                    ? j.items
                    : Array.isArray(j === null || j === void 0 ? void 0 : j.data)
                        ? j.data
                        : [];
            pendingAll += arr.length;
            token = ((j === null || j === void 0 ? void 0 : j.nextToken) ? String(j.nextToken) : '') || null;
            // small safety to avoid infinite loops on malformed tokens
            if (token && typeof token !== 'string')
                token = null;
        } while (token);
    }
    catch (_a) {
        // Fallback: bounded per-shop sum (may be approximate if shops lack credentials)
        pendingApprox = true;
        const perShopPending = await Promise.all(shops.map(async (s) => await (0, jumia_1.getPendingOrdersCountQuickForShop)({ shopId: s.id, limitPages: 10, size: 100, timeMs: 20000 }).catch(() => ({ total: 0, approx: true }))));
        pendingAll = perShopPending.reduce((n, s) => n + ((s === null || s === void 0 ? void 0 : s.total) || 0), 0);
        pendingApprox = perShopPending.some((s) => s === null || s === void 0 ? void 0 : s.approx) || false;
    }
    const productsAll = prodAll.total;
    const approx = Boolean(prodAll.approx) || pendingApprox;
    const payload = { productsAll, pendingAll, approx, updatedAt: Date.now() };
    await (0, kpisCache_1.writeKpisCache)(payload);
    return payload;
}
