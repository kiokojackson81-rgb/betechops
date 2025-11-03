"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const oidc_1 = require("@/lib/oidc");
// Keep this in sync with your vendor base resolver elsewhere
function resolveBaseUrl(input) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = input !== null && input !== void 0 ? input : process.env.base_url) !== null && _a !== void 0 ? _a : process.env.BASE_URL) !== null && _b !== void 0 ? _b : process.env.JUMIA_API_BASE) !== null && _c !== void 0 ? _c : "https://vendor-api.jumia.com");
}
async function POST(req) {
    var _a, _b, _c, _d;
    let body;
    try {
        body = (await req.json());
    }
    catch (_e) {
        return server_1.NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const { shopId, path, method = "GET", query = {}, json } = body;
    if (!(path === null || path === void 0 ? void 0 : path.startsWith("/"))) {
        return server_1.NextResponse.json({ ok: false, error: "path must start with /" }, { status: 400 });
    }
    // Load shop credentials if provided
    let platform = "JUMIA";
    let baseFromShop;
    let tokenMeta = {};
    try {
        let shopCreds = {};
        if (shopId) {
            const shop = await prisma_1.prisma.shop.findUnique({
                where: { id: shopId },
                select: { id: true, name: true, platform: true, credentialsEncrypted: true, apiConfig: true },
            });
            if (!shop)
                return server_1.NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
            platform = shop.platform || "JUMIA";
            // Normalize credentials JSON
            try {
                shopCreds = oidc_1.ShopAuthSchema.partial().parse((_b = (_a = shop.credentialsEncrypted) !== null && _a !== void 0 ? _a : shop.apiConfig) !== null && _b !== void 0 ? _b : {});
            }
            catch (_f) {
                shopCreds = {};
            }
            if (!shopCreds.platform)
                shopCreds.platform = platform;
            baseFromShop = shopCreds.apiBase || shopCreds.base_url;
        }
        const token = await (0, oidc_1.getJumiaAccessToken)(Object.assign({ platform }, (shopId ? shopCreds : {})));
        // token may be string (legacy) or AccessToken with _meta
        tokenMeta = token._meta || {};
        const base = resolveBaseUrl(baseFromShop);
        // Build URL with query params
        const url = new URL(path, base);
        Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const resp = await fetch(url.toString(), {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token.access_token}`,
            },
            body: method.toUpperCase() === "GET" || method.toUpperCase() === "DELETE" ? undefined : JSON.stringify(json !== null && json !== void 0 ? json : {}),
            // don't cache live console calls
            cache: "no-store",
        });
        const text = await resp.text();
        let data = text;
        try {
            data = JSON.parse(text);
        }
        catch (_g) {
            // leave as text if not JSON
        }
        return server_1.NextResponse.json({
            ok: resp.ok,
            status: resp.status,
            _meta: {
                authSource: (_c = tokenMeta.source) !== null && _c !== void 0 ? _c : "ENV",
                platform,
                baseUrl: base,
                tokenUrl: tokenMeta.tokenUrl,
                path: url.pathname + url.search,
            },
            data,
        }, { status: resp.ok ? 200 : resp.status });
    }
    catch (e) {
        return server_1.NextResponse.json({
            ok: false,
            error: (e === null || e === void 0 ? void 0 : e.message) || "Console call failed",
            _meta: { authSource: (_d = tokenMeta.source) !== null && _d !== void 0 ? _d : "ENV", platform, baseUrl: baseFromShop || resolveBaseUrl(undefined) },
        }, { status: 500 });
    }
}
