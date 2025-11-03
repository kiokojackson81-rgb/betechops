"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHealth = computeHealth;
exports.computeShopsConnectivity = computeShopsConnectivity;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
async function computeHealth() {
    let productCount = 0;
    let dbOk = false;
    try {
        productCount = await prisma_1.prisma.product.count();
        dbOk = true;
    }
    catch (e) {
        console.error("computeHealth prisma error:", e);
    }
    const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
    const dbUrl = process.env.DATABASE_URL || "";
    let dbScheme = null;
    let dbHost = null;
    try {
        if (dbUrl) {
            const u = new URL(dbUrl.replace(/^postgres:\/\//, "postgresql://"));
            dbScheme = u.protocol.replace(":", "");
            dbHost = u.hostname;
        }
    }
    catch (_a) {
        // ignore parse errors
    }
    return {
        status: "ok",
        productCount,
        authReady,
        dbOk,
        hasDatabaseUrl: Boolean(dbUrl),
        dbScheme,
        dbHost,
        timestamp: new Date().toISOString(),
    };
}
async function computeShopsConnectivity() {
    var _a;
    const shops = await prisma_1.prisma.shop.findMany({ select: { id: true, name: true, platform: true, isActive: true }, orderBy: { name: 'asc' } });
    const today = new Date();
    const yyyy = today.toISOString().slice(0, 10);
    const out = [];
    for (const s of shops) {
        // Ping: JUMIA via getOrders; KILIMALL pending until official API
        let ping = { ok: false };
        if (s.platform === 'JUMIA') {
            try {
                const j = await (0, jumia_1.getOrders)({ size: 1, createdAfter: yyyy, createdBefore: yyyy, shopId: s.id });
                const arr = Array.isArray(j === null || j === void 0 ? void 0 : j.orders)
                    ? j.orders
                    : Array.isArray(j === null || j === void 0 ? void 0 : j.items)
                        ? j.items
                        : Array.isArray(j === null || j === void 0 ? void 0 : j.data)
                            ? j.data
                            : [];
                ping = { ok: true, status: 200, count: arr.length };
            }
            catch (e) {
                const status = (_a = e === null || e === void 0 ? void 0 : e.status) !== null && _a !== void 0 ? _a : 0;
                const msg = (e instanceof Error ? e.message : String(e)) || 'error';
                ping = { ok: false, status, error: msg };
            }
        }
        else if (s.platform === 'KILIMALL') {
            ping = { ok: false, status: 0, error: 'pending integration' };
        }
        else {
            ping = { ok: false, status: 0, error: 'unknown platform' };
        }
        // Last activity timestamps (proxy for last sync)
        const [o, f, stl, ret] = await Promise.all([
            prisma_1.prisma.order.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
            prisma_1.prisma.fulfillmentAudit.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
            prisma_1.prisma.settlementRow.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
            prisma_1.prisma.returnCase.findFirst({ where: { shopId: s.id }, select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }).catch(() => null),
        ]);
        const lastOrder = (o === null || o === void 0 ? void 0 : o.createdAt) ? o.createdAt.toISOString() : null;
        const lastFulfill = (f === null || f === void 0 ? void 0 : f.createdAt) ? f.createdAt.toISOString() : null;
        const lastSettlement = (stl === null || stl === void 0 ? void 0 : stl.createdAt) ? stl.createdAt.toISOString() : null;
        const lastReturn = (ret === null || ret === void 0 ? void 0 : ret.updatedAt) ? ret.updatedAt.toISOString() : null;
        const maxTs = [lastOrder, lastFulfill, lastSettlement, lastReturn]
            .filter(Boolean)
            .map((t) => new Date(t).getTime());
        const lastSeenAt = maxTs.length ? new Date(Math.max(...maxTs)).toISOString() : null;
        out.push({
            id: s.id,
            name: s.name,
            platform: s.platform,
            isActive: s.isActive,
            ping,
            lastActivity: { order: lastOrder, fulfillment: lastFulfill, settlement: lastSettlement, returns: lastReturn },
            lastSeenAt,
        });
    }
    return out;
}
