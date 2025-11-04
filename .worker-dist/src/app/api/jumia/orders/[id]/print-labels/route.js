"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
const prisma_1 = require("@/lib/prisma");
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
        const success = data?.success;
        if (success)
            haystacks.push(success);
        const firstOrderItem = Array.isArray(success?.labels) ? success.labels[0] : undefined;
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
async function fetchLabels(orderItemIds, shopId) {
    return await (0, jumia_1.postOrdersPrintLabels)(shopId ? { shopId, orderItemIds } : { orderItemIds });
}
async function respondWithPdf(orderItemIds, identifier, shopId) {
    const result = await fetchLabels(orderItemIds, shopId);
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
    const sp = new URL(_req.url).searchParams;
    const shopIdParam = (sp.get("shopId") || "").trim();
    let shopId = shopIdParam;
    // Try to resolve shopId via DB if not provided (treat path id as orderId first)
    if (!shopId) {
        try {
            const row = await prisma_1.prisma.jumiaOrder.findUnique({ where: { id }, select: { shopId: true } });
            if (row?.shopId)
                shopId = row.shopId;
        }
        catch { }
    }
    // If we have a shopId, prefer to treat `id` as orderId and expand to item IDs
    let orderItemIds = [];
    if (shopId) {
        try {
            const itemsResp = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
            const items = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
            orderItemIds = items.map((it) => String(it?.id || "")).filter(Boolean);
        }
        catch { }
    }
    // Fallback: treat `id` as orderItemId
    if (!orderItemIds.length && id)
        orderItemIds = [id];
    if (!orderItemIds.length)
        return (0, api_1.noStoreJson)({ ok: false, error: "order item id required" }, { status: 400 });
    try {
        const pdf = await respondWithPdf(orderItemIds, id, shopId || undefined);
        if (pdf)
            return pdf;
        const result = await fetchLabels(orderItemIds, shopId || undefined);
        return (0, api_1.noStoreJson)({ ok: false, error: "Label not available", result }, { status: 502 });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
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
    let orderItemIds = normalizeIdsFromBody(body, id);
    if ((!orderItemIds || orderItemIds.length === 0) && shopId) {
        try {
            const itemsResp = await (0, jumia_1.getOrderItems)({ shopId, orderId: id });
            const items = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
            orderItemIds = items.map((it) => String(it?.id || "")).filter(Boolean);
        }
        catch { }
    }
    if (!orderItemIds.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "orderItemIds required" }, { status: 400 });
    }
    try {
        const labelResponse = await respondWithPdf(orderItemIds, orderItemIds[0] ?? id, shopId || undefined);
        if (labelResponse)
            return labelResponse;
        const fallback = await fetchLabels(orderItemIds, shopId || undefined);
        return (0, api_1.noStoreJson)({ ok: true, result: fallback, orderItemIds, shopId: shopId || undefined }, { status: 201 });
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
