"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
function normalizeIdsFromBody(body, fallbackId) {
    if (body && typeof body === "object") {
        const ids = body.orderItemIds;
        if (Array.isArray(ids)) {
            const cleaned = ids
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
function extractLabel(data, fallbackName) {
    if (!data)
        return null;
    if (typeof data === "object" && "_binary" in data) {
        const record = data;
        if (record._binary && typeof record._binary === "string") {
            return {
                base64: record._binary,
                filename: `${fallbackName}.pdf`,
                contentType: record.contentType || "application/pdf",
            };
        }
    }
    const haystacks = [];
    if (typeof data === "object") {
        haystacks.push(data);
        const success = data === null || data === void 0 ? void 0 : data.success;
        if (success)
            haystacks.push(success);
        const firstOrderItem = Array.isArray(success === null || success === void 0 ? void 0 : success.labels) ? success.labels[0] : undefined;
        if (firstOrderItem)
            haystacks.push(firstOrderItem);
    }
    for (const entry of haystacks) {
        if (!entry || typeof entry !== "object")
            continue;
        const candidate = entry;
        const label = (typeof candidate.label === "string" && candidate.label) ||
            (typeof candidate.labelBase64 === "string" && candidate.labelBase64) ||
            (typeof candidate.content === "string" && candidate.content);
        if (label) {
            const filename = (typeof candidate.labelFilename === "string" && candidate.labelFilename) ||
                (typeof candidate.filename === "string" && candidate.filename) ||
                `${fallbackName}.pdf`;
            return { base64: label, filename, contentType: "application/pdf" };
        }
    }
    return null;
}
async function fetchLabels(orderItemIds) {
    return await (0, jumia_1.postOrdersPrintLabels)({ orderItemIds });
}
async function respondWithPdf(orderItemIds, identifier) {
    const result = await fetchLabels(orderItemIds);
    const label = extractLabel(result, identifier);
    if (!label)
        return null;
    const buf = Buffer.from(label.base64, "base64");
    return new server_1.NextResponse(buf, {
        headers: {
            "Content-Type": label.contentType,
            "Content-Length": String(buf.length),
            "Cache-Control": "no-store",
            "Content-Disposition": `inline; filename="${encodeURIComponent(label.filename)}"`,
        },
    });
}
async function GET(_req, context) {
    const { id } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const orderItemIds = id ? [id] : [];
    if (!orderItemIds.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "order item id required" }, { status: 400 });
    }
    try {
        const pdf = await respondWithPdf(orderItemIds, id);
        if (pdf)
            return pdf;
        const result = await fetchLabels(orderItemIds);
        return (0, api_1.noStoreJson)({ ok: false, error: "Label not available", result }, { status: 502 });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
}
async function POST(req, context) {
    var _a, _b;
    const { id } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    let body = undefined;
    if ((_a = req.headers.get("content-type")) === null || _a === void 0 ? void 0 : _a.includes("application/json")) {
        try {
            body = await req.json();
        }
        catch (_c) {
            return (0, api_1.noStoreJson)({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
    }
    const orderItemIds = normalizeIdsFromBody(body, id);
    if (!orderItemIds.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "orderItemIds required" }, { status: 400 });
    }
    try {
        const labelResponse = await respondWithPdf(orderItemIds, (_b = orderItemIds[0]) !== null && _b !== void 0 ? _b : id);
        if (labelResponse)
            return labelResponse;
        const fallback = await fetchLabels(orderItemIds);
        return (0, api_1.noStoreJson)({ ok: true, result: fallback, orderItemIds });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
}
