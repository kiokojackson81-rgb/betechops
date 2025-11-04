"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const oidc_1 = require("@/lib/oidc");
// Keep this in sync with your vendor base resolver elsewhere
function resolveBaseUrl(input) {
    return (input ??
        process.env.base_url ??
        process.env.BASE_URL ??
        process.env.JUMIA_API_BASE ??
        "https://vendor-api.jumia.com");
}
async function POST(req) {
    let body;
    try {
        body = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const { shopId, path, method = "GET", query = {}, json } = body;
    if (!path?.startsWith("/")) {
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
                shopCreds = oidc_1.ShopAuthSchema.partial().parse(shop.credentialsEncrypted ?? shop.apiConfig ?? {});
            }
            catch {
                shopCreds = {};
            }
            if (!shopCreds.platform)
                shopCreds.platform = platform;
            baseFromShop = shopCreds.apiBase || shopCreds.base_url;
        }
        const token = await (0, oidc_1.getJumiaAccessToken)({ platform, ...(shopId ? shopCreds : {}) });
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
            body: method.toUpperCase() === "GET" || method.toUpperCase() === "DELETE" ? undefined : JSON.stringify(json ?? {}),
            // don't cache live console calls
            cache: "no-store",
        });
        const text = await resp.text();
        let data = text;
        try {
            data = JSON.parse(text);
        }
        catch {
            // leave as text if not JSON
        }
        return server_1.NextResponse.json({
            ok: resp.ok,
            status: resp.status,
            _meta: {
                authSource: tokenMeta.source ?? "ENV",
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
            error: e?.message || "Console call failed",
            _meta: { authSource: tokenMeta.source ?? "ENV", platform, baseUrl: baseFromShop || resolveBaseUrl(undefined) },
        }, { status: 500 });
    }
}
