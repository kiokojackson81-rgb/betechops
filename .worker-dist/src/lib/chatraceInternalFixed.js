"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushInternalReceiptAlert = pushInternalReceiptAlert;
exports.pushInternalDailySummary = pushInternalDailySummary;
const crypto_1 = require("crypto");
const prisma_1 = require("@/lib/prisma");
function getEnv() {
    const baseUrl = process.env.CHATRACE_INTERNAL_BASE_URL || "https://api.chatrace.com";
    const accountId = process.env.CHATRACE_INTERNAL_ACCOUNT_ID || "";
    const token = process.env.CHATRACE_INTERNAL_API_TOKEN || "";
    const adminPhone = process.env.CHATRACE_INTERNAL_ADMIN_PHONE || "";
    const enabled = process.env.CHATRACE_INTERNAL_ENABLED === "1";
    const envOk = Boolean(baseUrl && accountId && token && adminPhone);
    return { baseUrl, accountId, token, adminPhone, enabled, envOk };
}
function snippet(text, max = 220) {
    if (!text)
        return "";
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
async function postJson(url, token, body, rid) {
    const timeoutMs = 8000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "X-ACCESS-TOKEN": token,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        clearTimeout(id);
        const raw = await res.text().catch(() => "");
        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        }
        catch {
            parsed = null;
        }
        if (!res.ok) {
            console.error('[chatrace][internal][http] non-2xx', {
                rid: rid || null,
                url,
                status: res.status,
                bodySnippet: snippet(raw, 500),
            });
        }
        return { status: res.status, ok: res.ok, bodySnippet: snippet(raw), raw, json: parsed };
    }
    catch (e) {
        clearTimeout(id);
        const stack = e && e.stack ? e.stack : String(e);
        console.error('[chatrace][internal][http] exception', { rid: rid || null, url, stack });
        const err = String(e);
        return { status: 0, ok: false, bodySnippet: snippet(err), raw: err, json: null };
    }
}
function makeDebug(rid, env) {
    return {
        ok: false,
        rid,
        enabled: env.enabled,
        env: {
            baseUrlPresent: Boolean(env.baseUrl),
            accountIdPresent: Boolean(env.accountId),
            tokenPresent: Boolean(env.token),
            adminPhonePresent: Boolean(env.adminPhone),
        },
        steps: {},
    };
}
const CONTACTS_PATH = "/contacts";
async function pushInternalReceiptAlert(input) {
    const rid = input.requestId || (0, crypto_1.randomUUID)();
    const env = getEnv();
    const debug = makeDebug(rid, env);
    if (!env.enabled)
        return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
    if (!env.envOk)
        return { ok: false, debug: { ...debug, error: "missing_internal_env" } };
    // If caller passed URLs, explicitly ignore them for internal alerts and log that fact
    if (input.receiptLink) {
        console.info('[internal][adminAlert] ignoring receiptLink (static button in WA template)', { receiptNumber: input.receiptNumber });
    }
    if (input.receiptPdfUrl) {
        console.info('[internal][adminAlert] ignoring receiptPdfUrl for internal alert', { receiptNumber: input.receiptNumber });
    }
    const actions = [
        { action: "set_field_value", field_name: "admin_receipt_number", value: input.receiptNumber },
        { action: "set_field_value", field_name: "admin_amount", value: input.amount },
        { action: "set_field_value", field_name: "admin_payment_method", value: input.paymentMethod },
        { action: "set_field_value", field_name: "admin_created_by", value: input.createdBy },
        { action: "set_field_value", field_name: "admin_items", value: input.itemsText },
        { action: "add_tag", tag_name: "receipt_admin_alert" },
    ];
    // IMPORTANT: prove what's being sent to Chatrace for auditing (fields + tag)
    try {
        console.info('[internal][adminAlert] outbound', {
            phone: env.adminPhone,
            fields: actions.filter((a) => a.action === 'set_field_value').map((a) => a.field_name),
            hasPdfUrl: Boolean(input.receiptPdfUrl),
            hasLink: Boolean(input.receiptLink),
            tag: 'receipt_admin_alert',
        });
    }
    catch (e) {
        console.warn('[internal][adminAlert] failed to log outbound_actions', String(e));
    }
    const payload = { phone: env.adminPhone, actions };
    const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
    const step = await postJson(url, env.token, payload, rid);
    try {
        console.info('[internal][adminAlert] response', {
            status: step.status,
            ok: step.ok,
            snippet: step.bodySnippet,
            json: step.json ?? null,
            rawHead: step.raw ? (step.raw.length > 500 ? step.raw.slice(0, 500) : step.raw) : null,
        });
    }
    catch (e) {
        console.warn('[internal][adminAlert] failed to log response', String(e));
    }
    debug.steps.createOrUpdate = step;
    debug.ok = step.ok;
    // persist debug to DB for later inspection
    try {
        await persistInternalDebug(input.receiptNumber, rid, debug);
    }
    catch (e) {
        console.error('[internal][adminAlert] persist debug failed', String(e));
    }
    return { ok: step.ok, debug };
}
async function persistInternalDebug(receiptNumber, rid, debug) {
    if (process.env.NODE_ENV === 'test')
        return;
    try {
        const receipt = await prisma_1.prisma.receipt.findFirst({
            where: { OR: [{ id: receiptNumber }, { order: { orderNumber: receiptNumber } }] },
        });
        if (!receipt)
            return;
        const baseData = typeof receipt.data === 'object' && receipt.data ? { ...receipt.data } : {};
        const existing = typeof baseData.chatrace === 'object' && baseData.chatrace ? { ...baseData.chatrace } : {};
        const next = { ...baseData, chatrace: { ...existing, internal: { ...(existing.internal || {}), [rid]: debug } } };
        await prisma_1.prisma.receipt.update({ where: { id: receipt.id }, data: { data: next } });
    }
    catch (e) {
        console.error('[chatrace][internal] failed to persist debug', e);
    }
}
async function pushInternalDailySummary(input) {
    const rid = input.requestId || (0, crypto_1.randomUUID)();
    const env = getEnv();
    const debug = makeDebug(rid, env);
    if (!env.enabled)
        return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
    if (!env.envOk)
        return { ok: false, debug: { ...debug, error: "missing_internal_env" } };
    const payload = {
        phone: env.adminPhone,
        actions: [
            { action: "set_field_value", field_name: "summary_date", value: input.dateLabel },
            { action: "set_field_value", field_name: "summary_total_receipts", value: input.totalReceipts },
            { action: "set_field_value", field_name: "summary_total_sales", value: input.totalSales },
            { action: "set_field_value", field_name: "summary_total_profit", value: input.totalProfit },
            { action: "set_field_value", field_name: "summary_total_mpesa", value: input.totalMpesa },
            { action: "set_field_value", field_name: "summary_total_cash", value: input.totalCash },
            { action: "add_tag", tag_name: "daily_receipt_summary" },
        ],
    };
    const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
    const step = await postJson(url, env.token, payload);
    debug.steps.createOrUpdate = step;
    debug.ok = step.ok;
    return { ok: step.ok, debug };
}
