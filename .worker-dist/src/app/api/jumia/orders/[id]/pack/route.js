"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
const prisma_1 = require("@/lib/prisma");
function extractShipmentProviderId(candidate) {
    if (!candidate || typeof candidate !== "object")
        return null;
    const c = candidate;
    const keys = ["shipmentProviderId", "id", "sid", "providerId", "code"];
    for (const key of keys) {
        const value = c[key];
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return null;
}
async function resolveShipmentProviderId(orderItemId, shopId) {
    try {
        const resp = await (shopId ? (0, jumia_1.getShipmentProviders)({ shopId, orderItemIds: [orderItemId] }) : (0, jumia_1.getShipmentProviders)(orderItemId));
        const orderItems = Array.isArray(resp?.orderItems) ? resp.orderItems : [];
        for (const item of orderItems) {
            const providers = Array.isArray(item?.shipmentProviders) ? item.shipmentProviders : [];
            for (const provider of providers) {
                const id = extractShipmentProviderId(provider);
                if (id)
                    return id;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
async function resolveAndMaybePersistDefault(shopId, orderItemId) {
    // Try default first
    try {
        const row = await prisma_1.prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
        const defaults = (row?.json || {});
        const def = defaults?.[shopId]?.providerId;
        if (def && def !== 'auto')
            return def;
    }
    catch { }
    // Discover providers
    try {
        const prov = await (0, jumia_1.getShipmentProviders)({ shopId, orderItemIds: [orderItemId] }).catch(() => ({ providers: [] }));
        const providers = Array.isArray(prov?.providers) ? prov.providers : [];
        if (providers.length === 1) {
            const pid = String((providers[0]?.id ?? providers[0]?.providerId) || "");
            try {
                const row = await prisma_1.prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
                const next = { ...(row?.json || {}) };
                next[shopId] = { providerId: pid, label: String(providers[0]?.name || providers[0]?.label || pid) };
                await prisma_1.prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: next }, create: { key: 'jumia:shipper-defaults', json: next } });
            }
            catch { }
            return pid;
        }
        // Prefer a non-tracking provider
        const pick = providers.find((p) => !p?.requiredTrackingCode) || providers[0];
        if (pick)
            return String((pick?.id ?? pick?.providerId) || "");
    }
    catch { }
    return null;
}
function sanitizePayload(body) {
    if (!body || typeof body !== "object")
        return null;
    const orderItems = body.orderItems;
    if (!Array.isArray(orderItems))
        return null;
    const cleaned = orderItems
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const id = item.id;
        if (typeof id !== "string" && typeof id !== "number")
            return null;
        const normalizedId = String(id).trim();
        if (!normalizedId)
            return null;
        const payloadItem = { ...item, id: normalizedId };
        return payloadItem;
    })
        .filter(Boolean);
    if (!cleaned.length)
        return null;
    return { orderItems: cleaned };
}
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
    let payload = sanitizePayload(body);
    if (!payload) {
        const shipmentProviderId = (body && typeof body === "object" && typeof body.shipmentProviderId === "string"
            ? (body.shipmentProviderId || "").trim()
            : "") || (shopId ? await resolveAndMaybePersistDefault(shopId, id) : await resolveShipmentProviderId(id, shopId || undefined));
        if (!shipmentProviderId) {
            // Treat path param as orderId: fetch its items and resolve providers per item
            let items = [];
            if (shopId) {
                try {
                    const itemsResp = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
                    items = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
                }
                catch { }
            }
            const orderItems = [];
            for (const it of items) {
                const resolved = shopId
                    ? await resolveAndMaybePersistDefault(shopId, String(it?.id || ""))
                    : await resolveShipmentProviderId(String(it?.id || ""), shopId || undefined);
                orderItems.push({ id: String(it?.id || ""), shipmentProviderId: resolved || undefined });
            }
            const cleaned = orderItems.filter((x) => x.id);
            if (!cleaned.length || !cleaned.every((x) => typeof x.shipmentProviderId === "string" && x.shipmentProviderId)) {
                return (0, api_1.noStoreJson)({ ok: false, error: "Unable to determine shipmentProviderId for packing" }, { status: 400 });
            }
            payload = { orderItems: cleaned };
        }
        else {
            payload = { orderItems: [{ id, shipmentProviderId }] };
        }
    }
    // Ensure every order item has a shipmentProviderId
    const enriched = await Promise.all(payload.orderItems.map(async (item) => {
        if (typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim())
            return item;
        const derived = await resolveShipmentProviderId(item.id, shopId || undefined);
        if (!derived)
            return item;
        return { ...item, shipmentProviderId: derived };
    }));
    if (!enriched.every((item) => typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim())) {
        return (0, api_1.noStoreJson)({ ok: false, error: "Missing shipmentProviderId for one or more order items" }, { status: 400 });
    }
    try {
        const result = await (0, jumia_1.postOrdersPack)(shopId ? { shopId, orderItems: enriched } : { orderItems: enriched });
        return (0, api_1.noStoreJson)({ ok: true, orderItems: enriched, result, shopId: shopId || undefined }, { status: 201 });
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
