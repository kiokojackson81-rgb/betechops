"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const p_limit_1 = __importDefault(require("p-limit"));
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
async function GET(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const persist = url.searchParams.get("persist") === "1";
    const concurrency = Math.max(1, Math.min(5, Number(url.searchParams.get("concurrency") || 3)));
    try {
        const shops = await prisma_1.prisma.shop.findMany({
            where: { platform: "JUMIA", isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        const limit = (0, p_limit_1.default)(concurrency);
        const results = await Promise.all(shops.map((s) => limit(async () => {
            try {
                const recent = await prisma_1.prisma.jumiaOrder
                    .findFirst({ where: { shopId: s.id }, orderBy: { updatedAt: "desc" }, select: { id: true } })
                    .catch(() => null);
                if (!recent) {
                    return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], singleProvider: false, error: "noOrders" };
                }
                const itemsResp = await (0, jumia_1.getOrderItems)({ shopId: s.id, orderId: recent.id }).catch(() => ({ items: [] }));
                const items = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
                const firstItemId = items.length ? String(items[0]?.id || "") : "";
                if (!firstItemId) {
                    return { shopId: s.id, shopName: s.name, orderId: recent.id, sampleOrderItemId: null, providers: [], singleProvider: false, error: "noItems" };
                }
                const prov = await (0, jumia_1.getShipmentProviders)({ shopId: s.id, orderItemIds: [firstItemId] }).catch(() => ({ providers: [] }));
                const providersArr = Array.isArray(prov?.providers)
                    ? prov.providers
                    : Array.isArray(prov?.orderItems?.[0]?.shipmentProviders)
                        ? prov.orderItems[0].shipmentProviders
                        : [];
                const providers = providersArr.map((p) => ({
                    id: String((p?.id ?? p?.providerId ?? p?.code) || ""),
                    name: typeof p?.name === "string" ? p.name : typeof p?.label === "string" ? p.label : undefined,
                    requiresTracking: !!p?.requiredTrackingCode,
                })).filter((p) => p.id);
                // Optionally persist a single provider default for this shop
                if (persist && providers.length === 1) {
                    try {
                        const row = await prisma_1.prisma.config.findUnique({ where: { key: "jumia:shipper-defaults" } });
                        const curr = (row?.json || {});
                        const next = { ...curr, [s.id]: { providerId: providers[0].id, label: providers[0].name || providers[0].id } };
                        await prisma_1.prisma.config.upsert({ where: { key: "jumia:shipper-defaults" }, update: { json: next }, create: { key: "jumia:shipper-defaults", json: next } });
                    }
                    catch { }
                }
                return {
                    shopId: s.id,
                    shopName: s.name,
                    orderId: recent.id,
                    sampleOrderItemId: firstItemId,
                    providers,
                    singleProvider: providers.length === 1,
                };
            }
            catch (e) {
                return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], singleProvider: false, error: String(e instanceof Error ? e.message : e) };
            }
        })));
        return (0, api_1.noStoreJson)({ ok: true, persistApplied: persist, results });
    }
    catch (e) {
        return (0, api_1.noStoreJson)({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
