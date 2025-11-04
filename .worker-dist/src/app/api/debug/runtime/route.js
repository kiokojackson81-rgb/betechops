"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
const jumia_1 = require("@/lib/jumia");
const oidc_1 = require("@/lib/oidc");
exports.dynamic = "force-dynamic";
async function GET() {
    try {
        const h = await (0, headers_1.headers)();
        const proto = h.get("x-forwarded-proto") ?? "https";
        const host = h.get("x-forwarded-host") ?? h.get("host");
        const origin = host ? `${proto}://${host}` : "";
        const hasDB = Boolean(process.env.DATABASE_URL);
        const hasKey = Boolean(process.env.SECURE_JSON_KEY);
        const shopAuth = await (0, jumia_1.loadDefaultShopAuth)().catch(() => undefined);
        const resolved = await (0, jumia_1.resolveJumiaConfig)({ shopAuth: shopAuth ?? undefined });
        let tokenMeta;
        let authError;
        try {
            if (shopAuth) {
                const t = await (0, oidc_1.getJumiaAccessToken)(shopAuth);
                tokenMeta = t?._meta || undefined;
            }
        }
        catch (e) {
            authError = e?.message || String(e);
        }
        return server_1.NextResponse.json({
            origin,
            absOrders: origin ? `${origin}/api/orders` : "/api/orders",
            env: { hasDB, hasKey },
            jumia: { base: resolved.base, scheme: resolved.scheme },
            shopAuthPresent: Boolean(shopAuth?.clientId && shopAuth?.refreshToken),
            tokenMeta,
            authError,
        });
    }
    catch (e) {
        return server_1.NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
    }
}
