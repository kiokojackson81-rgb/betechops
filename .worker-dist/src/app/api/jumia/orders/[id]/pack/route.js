"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
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
async function resolveShipmentProviderId(orderItemId) {
    try {
        const resp = await (0, jumia_1.getShipmentProviders)(orderItemId);
        const orderItems = Array.isArray(resp === null || resp === void 0 ? void 0 : resp.orderItems) ? resp.orderItems : [];
        for (const item of orderItems) {
            const providers = Array.isArray(item === null || item === void 0 ? void 0 : item.shipmentProviders) ? item.shipmentProviders : [];
            for (const provider of providers) {
                const id = extractShipmentProviderId(provider);
                if (id)
                    return id;
            }
        }
        return null;
    }
    catch (_a) {
        return null;
    }
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
        const payloadItem = Object.assign(Object.assign({}, item), { id: normalizedId });
        return payloadItem;
    })
        .filter(Boolean);
    if (!cleaned.length)
        return null;
    return { orderItems: cleaned };
}
async function POST(req, context) {
    var _a;
    const { id } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    let body = undefined;
    if ((_a = req.headers.get("content-type")) === null || _a === void 0 ? void 0 : _a.includes("application/json")) {
        try {
            body = await req.json();
        }
        catch (_b) {
            return (0, api_1.noStoreJson)({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
    }
    let payload = sanitizePayload(body);
    if (!payload) {
        const shipmentProviderId = (body && typeof body === "object" && typeof body.shipmentProviderId === "string"
            ? (body.shipmentProviderId || "").trim()
            : "") || (await resolveShipmentProviderId(id));
        if (!shipmentProviderId) {
            return (0, api_1.noStoreJson)({ ok: false, error: "Unable to determine shipmentProviderId for packing" }, { status: 400 });
        }
        payload = { orderItems: [{ id, shipmentProviderId }] };
    }
    // Ensure every order item has a shipmentProviderId
    const enriched = await Promise.all(payload.orderItems.map(async (item) => {
        if (typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim())
            return item;
        const derived = await resolveShipmentProviderId(item.id);
        if (!derived)
            return item;
        return Object.assign(Object.assign({}, item), { shipmentProviderId: derived });
    }));
    if (!enriched.every((item) => typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim())) {
        return (0, api_1.noStoreJson)({ ok: false, error: "Missing shipmentProviderId for one or more order items" }, { status: 400 });
    }
    try {
        const result = await (0, jumia_1.postOrdersPack)({ orderItems: enriched });
        return (0, api_1.noStoreJson)({ ok: true, orderItems: enriched, result });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
}
