"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNumber = parseNumber;
exports.parseIntLike = parseIntLike;
function parseNumber(value, fallback = 0) {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : fallback;
    const s = String(value).trim();
    if (!s)
        return fallback;
    // Remove common thousands separators and currency symbols, keep digits, dot and minus
    const cleaned = s.replace(/,/g, "").replace(/[^\d.\-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.")
        return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
}
function parseIntLike(value, fallback = 0) {
    const n = parseNumber(value, NaN);
    if (!Number.isFinite(n))
        return fallback;
    return Math.trunc(n) || fallback;
}
exports.default = parseNumber;
