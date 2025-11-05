"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
const prisma_1 = require("@/lib/prisma");
function parseOrderItemIds(body, fallbackId) {
    if (body && typeof body === "object") {
        const candidate = body.orderItemIds;
        if (Array.isArray(candidate)) {
            const cleaned = candidate
                .map((id) => (typeof id === "string" || typeof id === "number" ? String(id).trim() : ""))
                .filter(Boolean);
            if (cleaned.length)
                return cleaned;
        }
        const single = body.orderItemId;
        if (typeof single === "string" || typeof single === "number") {
            const normalized = String(single).trim();
            if (normalized)
                return [normalized];
        }
    }
    return fallbackId ? [fallbackId] : [];
}
const mapOrderItemId = (it) => String(it?.id || it?.orderItemId || it?.order_item_id || "");
async function POST(req, context) {
    const { id } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    let body = undefined;
    if (req.headers.get("content-type")?.includes("application/json")) {
        try {
            body = await req.json();
        }
        catch {
            return (0, api_1.noStoreJson)({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
    }
    const sp = req.nextUrl.searchParams;
    const shopIdParam = (sp.get("shopId") || "").trim();
    let shopId = shopIdParam;
    if (!shopId) {
        try {
            const row = await prisma_1.prisma.jumiaOrder.findUnique({ where: { id }, select: { shopId: true } });
            if (row?.shopId)
                shopId = row.shopId;
        }
        catch { }
    }
    let orderItemIds = parseOrderItemIds(body, id);
    let vendorItems = [];
    if (shopId) {
        try {
            const itemsResp = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
            vendorItems = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
        }
        catch {
            vendorItems = [];
        }
    }
    if (vendorItems.length) {
        const extractedIds = vendorItems
            .map(mapOrderItemId)
            .filter(Boolean);
        if (extractedIds.length) {
            orderItemIds = extractedIds;
        }
    }
    if (!orderItemIds.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "orderItemIds required" }, { status: 400 });
    }
    try {
        // Auto-pack if needed (when items are still PENDING) using default or single provider
        if (shopId) {
            try {
                if (!vendorItems.length) {
                    try {
                        const retry = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
                        vendorItems = Array.isArray(retry?.items) ? retry.items : [];
                    }
                    catch {
                        vendorItems = [];
                    }
                }
                const allItems = vendorItems.length ? vendorItems : [];
                if (vendorItems.length) {
                    const extractedIds = vendorItems.map(mapOrderItemId).filter(Boolean);
                    if (extractedIds.length) {
                        orderItemIds = extractedIds;
                    }
                }
                const idsSet = new Set(orderItemIds.map((oid) => String(oid)));
                const target = allItems.filter((it) => {
                    return idsSet.has(mapOrderItemId(it));
                });
                const pending = target.filter((it) => String(it?.status || "").toUpperCase() === "PENDING");
                if (pending.length > 0) {
                    // Load default provider
                    let defaults = {};
                    try {
                        const row = await prisma_1.prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
                        defaults = (row?.json || {});
                    }
                    catch { }
                    let providerId = defaults?.[shopId]?.providerId || "";
                    // Discover providers if no default
                    let requiredTracking = false;
                    if (!providerId || providerId === 'auto') {
                        const prov = await (0, jumia_1.getShipmentProviders)({ shopId, orderItemIds: [String(pending[0]?.id)] }).catch(() => ({ providers: [] }));
                        const providers = Array.isArray(prov?.providers) ? prov.providers : [];
                        if (providers.length === 1) {
                            providerId = String((providers[0]?.id ?? providers[0]?.providerId) || "");
                            requiredTracking = !!providers[0]?.requiredTrackingCode;
                            // Persist single-provider default for this shop
                            try {
                                const next = { ...(defaults || {}) };
                                next[shopId] = { providerId, label: String(providers[0]?.name || providers[0]?.label || providerId) };
                                await prisma_1.prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: next }, create: { key: 'jumia:shipper-defaults', json: next } });
                            }
                            catch { }
                        }
                        else if (providers.length > 1) {
                            // Prefer a provider that does not require tracking code
                            const pick = providers.find((p) => !p?.requiredTrackingCode) || providers[0];
                            providerId = String((pick?.id ?? pick?.providerId) || "");
                            requiredTracking = !!pick?.requiredTrackingCode;
                        }
                    }
                    // If still no providerId, stop with guidance
                    if (!providerId) {
                        return (0, api_1.noStoreJson)({ ok: false, error: "No shipment provider configured for this shop", hint: "Save a default in Settings → Jumia → Shipping Stations or ensure only one provider is active", shopId }, { status: 400 });
                    }
                    // Pack pending items before RTS
                    const toPackIds = pending.map(mapOrderItemId);
                    if (requiredTracking) {
                        const base = String(toPackIds[0]).slice(0, 8);
                        const trackingCode = `AUTO-${base}-${Date.now()}`.slice(0, 32);
                        await (0, jumia_1.postOrdersPackV2)({ shopId, packages: [{ orderItems: toPackIds, shipmentProviderId: providerId, trackingCode }] });
                    }
                    else {
                        await (0, jumia_1.postOrdersPack)({ shopId, orderItems: toPackIds.map((id) => ({ id, shipmentProviderId: providerId })) });
                    }
                }
            }
            catch {
                // best-effort auto-pack
            }
        }
        if (!vendorItems.length && shopId) {
            try {
                const retry = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
                vendorItems = Array.isArray(retry?.items) ? retry.items : [];
            }
            catch {
                vendorItems = [];
            }
        }
        if (vendorItems.length) {
            const extractedIds = vendorItems.map(mapOrderItemId).filter(Boolean);
            if (extractedIds.length) {
                orderItemIds = extractedIds;
            }
        }
        if (!orderItemIds.length) {
            return (0, api_1.noStoreJson)({ ok: false, error: "Unable to locate vendor order items for RTS action", shopId: shopId || undefined }, { status: 400 });
        }
        const result = await (0, jumia_1.postOrdersReadyToShip)(shopId ? { shopId, orderItemIds } : { orderItemIds });
        const newStatus = result && typeof result?.status === "string"
            ? String(result.status)
            : "READY_TO_SHIP";
        try {
            await prisma_1.prisma.jumiaOrder.update({
                where: { id },
                data: {
                    status: newStatus,
                    updatedAtJumia: new Date(),
                },
            });
        }
        catch {
            // best-effort persistence
        }
        return (0, api_1.noStoreJson)({ ok: true, orderItemIds, result, shopId: shopId || undefined }, { status: 201 });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.toLowerCase().includes("missing credentials")) {
            return (0, api_1.noStoreJson)({
                ok: false,
                error: "Missing credentials for Jumia Vendor API",
                hint: "Ensure per-shop OAuth refresh token is configured and pass ?shopId=...",
                shopId: shopId || undefined,
            }, { status: 400 });
        }
        return (0, api_1.noStoreJson)({ ok: false, error: message, shopId: shopId || undefined }, { status: 502 });
    }
}
