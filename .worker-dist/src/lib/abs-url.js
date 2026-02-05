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
    const h = await (0, headers_1.headers)();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    // Fail-open: if host is unavailable (some SSR/edge contexts), try env fallbacks then return a relative URL.
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (!host) {
        const envBase = process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
            null;
        if (envBase && /^(http|https):\/\//i.test(envBase)) {
            return `${envBase}${normalizedPath}`;
        }
        // Last resorts: try localhost absolute URL to keep fetch happy (relative may throw in some runtimes)
        const localhost = process.env.LOCALHOST_FALLBACK_BASE || 'http://localhost:3000';
        return `${localhost}${normalizedPath}`;
    }
    return `${proto}://${host}${normalizedPath}`;
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
