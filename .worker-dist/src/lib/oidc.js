"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopAuthSchema = void 0;
exports.getJumiaAccessToken = getJumiaAccessToken;
exports.getAccessTokenFromEnv = getAccessTokenFromEnv;
exports.getJumiaTokenInfo = getJumiaTokenInfo;
const zod_1 = require("zod");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TOKEN_MAX_CONCURRENCY = (() => {
    const raw = Number.parseInt(process.env.JUMIA_TOKEN_CONCURRENCY ?? "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
})();
const tokenQueue = [];
let tokenActive = 0;
async function withTokenSlot(fn) {
    if (!TOKEN_MAX_CONCURRENCY || TOKEN_MAX_CONCURRENCY <= 0)
        return fn();
    if (tokenActive >= TOKEN_MAX_CONCURRENCY) {
        await new Promise((resolve) => tokenQueue.push(resolve));
    }
    tokenActive += 1;
    try {
        return await fn();
    }
    finally {
        tokenActive -= 1;
        const next = tokenQueue.shift();
        if (next)
            next();
    }
}
function parseRetryAfter(value) {
    if (!value)
        return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0)
        return numeric * 1000;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
        const delta = parsed - Date.now();
        return delta > 0 ? delta : 0;
    }
    return null;
}
const redact = (s, keep = 4) => !s ? "" : s.length <= keep ? "****" : `${s.slice(0, keep)}…REDACTED`;
function getInflightMap() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!globalThis.__jumiaTokenInflight)
        globalThis.__jumiaTokenInflight = new Map();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return globalThis.__jumiaTokenInflight;
}
// Unified token getter: prefers per-shop JSON, falls back to env.
async function getJumiaAccessTokenWithMeta(shopAuth) {
    // 1) Resolve from shop JSON first
    const fromShop = shopAuth?.clientId && shopAuth?.refreshToken;
    const tokenUrl = shopAuth?.tokenUrl ||
        process.env.OIDC_TOKEN_URL ||
        process.env.JUMIA_OIDC_TOKEN_URL ||
        "https://vendor-api.jumia.com/token";
    const clientId = (fromShop ? shopAuth?.clientId : process.env.OIDC_CLIENT_ID) ||
        process.env.JUMIA_CLIENT_ID;
    const refreshToken = (fromShop ? shopAuth?.refreshToken : process.env.OIDC_REFRESH_TOKEN) ||
        process.env.JUMIA_REFRESH_TOKEN;
    const source = fromShop ? "SHOP" : "ENV";
    if (!clientId || !refreshToken) {
        throw new Error("Missing credentials: neither per-shop JSON nor ENV provided clientId & refreshToken.");
    }
    // In unit tests, avoid network calls entirely by returning a static token
    if (process.env.NODE_ENV === 'test') {
        return {
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600,
            _meta: { source, platform: shopAuth?.platform, tokenUrl },
        };
    }
    // Optional simple in-memory cache keyed by (source+clientId)
    const cacheKey = `${source}:${clientId}`;
    const now = Math.floor(Date.now() / 1000);
    // @ts-expect-error - global cache container for tokens; may not be typed on globalThis
    globalThis.__jumiaTokenCache ?? (globalThis.__jumiaTokenCache = new Map());
    // @ts-expect-error - global cache container for tokens; may not be typed on globalThis
    const cache = globalThis.__jumiaTokenCache;
    const cached = cache.get(cacheKey);
    if (cached && cached.exp > now + 60) {
        return { ...cached.token, _meta: { source, platform: shopAuth?.platform, tokenUrl } };
    }
    const inflight = getInflightMap();
    let recordPromise = inflight.get(cacheKey);
    if (!recordPromise) {
        const payload = new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }).toString();
        const headers = { "Content-Type": "application/x-www-form-urlencoded" };
        const maxAttempts = Number.isFinite(Number.parseInt(process.env.JUMIA_TOKEN_MAX_ATTEMPTS ?? "", 10))
            ? Math.max(1, Number.parseInt(process.env.JUMIA_TOKEN_MAX_ATTEMPTS ?? "", 10))
            : 4;
        const maxBackoffMs = Number.isFinite(Number.parseInt(process.env.JUMIA_TOKEN_MAX_BACKOFF_MS ?? "", 10))
            ? Math.max(500, Number.parseInt(process.env.JUMIA_TOKEN_MAX_BACKOFF_MS ?? "", 10))
            : 10000;
        recordPromise = withTokenSlot(async () => {
            let attempt = 0;
            let lastError = null;
            let lastStatus = 0;
            let lastBody = "";
            while (attempt < maxAttempts) {
                attempt += 1;
                let resp;
                try {
                    resp = await fetch(tokenUrl, { method: "POST", headers, body: payload });
                }
                catch (err) {
                    lastError = err;
                    if (attempt < maxAttempts) {
                        const wait = Math.min(Math.pow(2, attempt - 1) * 1000, maxBackoffMs) + Math.floor(Math.random() * 250);
                        await sleep(wait);
                        continue;
                    }
                    console.error("[OIDC] token exchange FAILED", {
                        source,
                        tokenUrl,
                        platform: shopAuth?.platform ?? "JUMIA",
                        clientId: redact(clientId),
                        refreshToken: redact(refreshToken),
                        status: 0,
                        error: err instanceof Error ? err.message : String(err),
                    });
                    throw new Error("OIDC token exchange failed (network error)");
                }
                if (resp.ok) {
                    const json = (await resp.json());
                    const expSeconds = Math.floor(Date.now() / 1000) + (json.expires_in ?? 3000);
                    const record = { token: json, exp: expSeconds };
                    cache.set(cacheKey, record);
                    console.info("[OIDC] token exchange OK", {
                        source,
                        tokenUrl,
                        platform: shopAuth?.platform ?? "JUMIA",
                        clientId: redact(clientId),
                        exp: expSeconds,
                    });
                    return record;
                }
                lastStatus = resp.status;
                lastBody = await resp.text();
                const retryable = resp.status === 429 || resp.status >= 500;
                if (retryable && attempt < maxAttempts) {
                    const retryAfter = parseRetryAfter(resp.headers?.get("retry-after"));
                    const backoff = Math.min(Math.pow(2, attempt - 1) * 1000, maxBackoffMs);
                    const wait = (retryAfter ?? backoff) + Math.floor(Math.random() * 250);
                    console.warn("[OIDC] token exchange RETRY", {
                        source,
                        tokenUrl,
                        platform: shopAuth?.platform ?? "JUMIA",
                        clientId: redact(clientId),
                        status: resp.status,
                        attempt,
                        maxAttempts,
                        waitMs: wait,
                    });
                    await sleep(wait);
                    continue;
                }
                console.error("[OIDC] token exchange FAILED", {
                    source,
                    tokenUrl,
                    platform: shopAuth?.platform ?? "JUMIA",
                    clientId: redact(clientId),
                    refreshToken: redact(refreshToken),
                    status: resp.status,
                    body: lastBody.slice(0, 400),
                });
                throw new Error(`OIDC token exchange failed (${resp.status})`);
            }
            console.error("[OIDC] token exchange FAILED", {
                source,
                tokenUrl,
                platform: shopAuth?.platform ?? "JUMIA",
                clientId: redact(clientId),
                refreshToken: redact(refreshToken),
                status: lastStatus,
                body: lastBody.slice(0, 400),
                error: lastError instanceof Error ? lastError.message : lastError ? String(lastError) : undefined,
            });
            throw new Error(`OIDC token exchange failed (${lastStatus || 0})`);
        });
        inflight.set(cacheKey, recordPromise);
        recordPromise.finally(() => {
            try {
                inflight.delete(cacheKey);
            }
            catch {
                /* noop */
            }
        });
    }
    const record = await recordPromise;
    return { ...record.token, _meta: { source, platform: shopAuth?.platform, tokenUrl } };
}
async function getJumiaAccessToken(shopAuth) {
    if (shopAuth === undefined) {
        const tok = (await getJumiaAccessTokenWithMeta(undefined));
        return tok.access_token;
    }
    return await getJumiaAccessTokenWithMeta(shopAuth);
}
// Helper to build ShopAuth from DB/JSON credentials
exports.ShopAuthSchema = zod_1.z.object({
    platform: zod_1.z.enum(["JUMIA", "KILIMALL"]).optional(),
    tokenUrl: zod_1.z.string().url().optional(),
    clientId: zod_1.z.string().min(3).optional(),
    refreshToken: zod_1.z.string().min(10).optional(),
});
// Backwards-compatible helpers used by other modules
async function getAccessTokenFromEnv() {
    // Prefer the standard env-based flow: call getJumiaAccessToken with no shopAuth
    const tokAny = await getJumiaAccessToken();
    if (typeof tokAny === 'string')
        return tokAny;
    return tokAny.access_token;
}
function getJumiaTokenInfo() {
    // Try to pick a cached entry if available
    // @ts-expect-error - access global cache if present
    const cache = globalThis.__jumiaTokenCache;
    if (cache && cache.size > 0) {
        for (const [k, v] of cache.entries()) {
            return { tokenUrl: v.token._meta?.tokenUrl || process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL, expiresAt: v.exp * 1000 };
        }
    }
    return { tokenUrl: process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL, expiresAt: undefined };
}
