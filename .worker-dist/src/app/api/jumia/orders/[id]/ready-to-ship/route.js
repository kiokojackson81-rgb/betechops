"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
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
    const orderItemIds = parseOrderItemIds(body, id);
    if (!orderItemIds.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "orderItemIds required" }, { status: 400 });
    }
    try {
        const result = await (0, jumia_1.postOrdersReadyToShip)({ orderItemIds });
        return (0, api_1.noStoreJson)({ ok: true, orderItemIds, result });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
}
