"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalReceiptNumber = canonicalReceiptNumber;
exports.businessDateKey = businessDateKey;
exports.businessDayRangeNairobi = businessDayRangeNairobi;
exports.buildReceiptKey = buildReceiptKey;
exports.withKeyLock = withKeyLock;
exports.parsePaymentMethod = parsePaymentMethod;
function canonicalReceiptNumber(v) {
    const s = String(v ?? "").trim();
    if (!s)
        return null;
    return s.replace(/\s|-/g, "").toUpperCase();
}
function businessDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function businessDayRangeNairobi(date, padDays = 0) {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);
    const start = new Date(base);
    start.setDate(start.getDate() - padDays);
    const end = new Date(base);
    end.setDate(end.getDate() + padDays);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
function buildReceiptKey(entryDate, serial) {
    const canonical = canonicalReceiptNumber(serial);
    if (!canonical)
        return null;
    return `${businessDateKey(entryDate)}:${canonical}`;
}
const locks = new Map();
async function withKeyLock(key, fn) {
    const prev = locks.get(key) ?? Promise.resolve();
    let release;
    const next = new Promise((r) => (release = r));
    locks.set(key, prev.then(() => next));
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
        if (locks.get(key) === next) {
            locks.delete(key);
        }
    }
}
function parsePaymentMethod(input, PaymentMethod) {
    return typeof input === "string" && input.toUpperCase() === "CASH"
        ? PaymentMethod.CASH
        : PaymentMethod.MPESA;
}
