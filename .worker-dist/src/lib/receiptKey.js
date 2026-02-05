"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReceiptId = normalizeReceiptId;
exports.receiptIdFromAny = receiptIdFromAny;
exports.normalizeReceiptNumber = normalizeReceiptNumber;
exports.normalizePaymentMethod = normalizePaymentMethod;
exports.buildReceiptKey = buildReceiptKey;
exports.mergePaymentStats = mergePaymentStats;
const WHITESPACE_REGEX = /\s+/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const DASH_CLUSTER_REGEX = /-+/g;
function normalizeReceiptId(value) {
    if (!value)
        return "";
    return String(value)
        .replace(ZERO_WIDTH_REGEX, "")
        .trim()
        .replace(WHITESPACE_REGEX, " ")
        .replace(DASH_CLUSTER_REGEX, "-")
        .toUpperCase();
}
function receiptIdFromAny(obj) {
    if (!obj || typeof obj !== "object")
        return "";
    const candidates = [
        obj.receiptNumber,
        obj.serial,
        obj.order?.orderNumber,
        obj.id,
    ];
    for (const candidate of candidates) {
        const normalized = normalizeReceiptId(candidate);
        if (normalized)
            return normalized;
    }
    return "";
}
function normalizeReceiptNumber(input) {
    if (input == null)
        return "";
    const s = String(input);
    const trimmed = s.trim();
    if (!trimmed)
        return "";
    // Uppercase, remove spaces/hyphens/underscores
    let out = trimmed.toUpperCase().replace(/[\s\-_]+/g, "");
    // Keep only alphanumerics
    out = out.replace(/[^A-Z0-9]/g, "");
    return out;
}
function normalizePaymentMethod(value) {
    const s = typeof value === "string" ? value.trim().toUpperCase() : "";
    return s === "CASH" ? "CASH" : "MPESA";
}
function buildReceiptKey(rawReceiptNumber, fallbackId) {
    const n = normalizeReceiptNumber(rawReceiptNumber);
    if (n && n.length > 0)
        return n;
    if (fallbackId)
        return `ID:${String(fallbackId)}`;
    return "";
}
function mergePaymentStats(acc, incoming) {
    acc.mpesa = (acc.mpesa || 0) + (incoming.mpesa || 0);
    acc.cash = (acc.cash || 0) + (incoming.cash || 0);
    if (incoming.mpesa && incoming.mpesa > 0) {
        acc.countMpesaReceipts = (acc.countMpesaReceipts || 0) + 1;
    }
    if (incoming.cash && incoming.cash > 0) {
        acc.countCashReceipts = (acc.countCashReceipts || 0) + 1;
    }
    return acc;
}
