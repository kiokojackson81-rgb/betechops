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
    var _a, _b;
    try {
        const h = await (0, headers_1.headers)();
        const proto = (_a = h.get("x-forwarded-proto")) !== null && _a !== void 0 ? _a : "https";
        const host = (_b = h.get("x-forwarded-host")) !== null && _b !== void 0 ? _b : h.get("host");
        const origin = host ? `${proto}://${host}` : "";
        const hasDB = Boolean(process.env.DATABASE_URL);
        const hasKey = Boolean(process.env.SECURE_JSON_KEY);
        const shopAuth = await (0, jumia_1.loadDefaultShopAuth)().catch(() => undefined);
        const resolved = await (0, jumia_1.resolveJumiaConfig)({ shopAuth: shopAuth !== null && shopAuth !== void 0 ? shopAuth : undefined });
        let tokenMeta;
        let authError;
        try {
            if (shopAuth) {
                const t = await (0, oidc_1.getJumiaAccessToken)(shopAuth);
                tokenMeta = (t === null || t === void 0 ? void 0 : t._meta) || undefined;
            }
        }
        catch (e) {
            authError = (e === null || e === void 0 ? void 0 : e.message) || String(e);
        }
        return server_1.NextResponse.json({
            origin,
            absOrders: origin ? `${origin}/api/orders` : "/api/orders",
            env: { hasDB, hasKey },
            jumia: { base: resolved.base, scheme: resolved.scheme },
            shopAuthPresent: Boolean((shopAuth === null || shopAuth === void 0 ? void 0 : shopAuth.clientId) && (shopAuth === null || shopAuth === void 0 ? void 0 : shopAuth.refreshToken)),
            tokenMeta,
            authError,
        });
    }
    catch (e) {
        return server_1.NextResponse.json({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) }, { status: 500 });
    }
}
