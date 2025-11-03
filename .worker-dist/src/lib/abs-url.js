"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.absUrl = absUrl;
exports.withParams = withParams;
// src/lib/abs-url.ts
const headers_1 = require("next/headers");
/**
 * Make an absolute URL for server-side fetches.
 * Falls back to https + host, works on Vercel behind proxies.
 */
async function absUrl(path) {
    var _a, _b;
    const h = await (0, headers_1.headers)();
    const proto = (_a = h.get("x-forwarded-proto")) !== null && _a !== void 0 ? _a : "https";
    const host = (_b = h.get("x-forwarded-host")) !== null && _b !== void 0 ? _b : h.get("host");
    if (!host)
        throw new Error("Cannot determine host for server-side fetch");
    return `${proto}://${host}${path.startsWith("/") ? path : `/${path}`}`;
}
/** Append search params only when present (avoids trailing '?') */
function withParams(base, params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && `${v}` !== "")
            usp.set(k, String(v));
    }
    return usp.toString() ? `${base}?${usp}` : base;
}
