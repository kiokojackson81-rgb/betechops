"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const oidc_1 = require("@/lib/oidc");
const oidc_2 = require("@/lib/oidc");
async function POST(req, context) {
    const params = await context.params;
    const id = params.id;
    // Pull only the credentials field from DB (adjust field name if needed)
    const shop = await prisma_1.prisma.shop.findUnique({
        where: { id },
        select: { id: true, name: true, platform: true, credentialsEncrypted: true, apiConfig: true },
    });
    if (!shop) {
        return server_1.NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
    }
    // Parse/normalize the stored JSON to our expected shape
    // Prefer credentialsEncrypted (JSON) stored on the shop; fall back to apiConfig if present
    const rawCreds = shop.credentialsEncrypted ?? shop.apiConfig ?? {};
    const parsed = oidc_1.ShopAuthSchema.partial().parse(rawCreds ?? {});
    // Ensure platform is visible to the token helper (default JUMIA)
    if (!parsed.platform)
        parsed.platform = shop.platform || "JUMIA";
    try {
        const tok = await oidc_2.getJumiaAccessToken(parsed);
        // tok may be string (legacy) or AccessToken with _meta
        const meta = typeof tok === 'string' ? undefined : tok._meta;
        return server_1.NextResponse.json({
            ok: true,
            shopId: shop.id,
            shopName: shop.name,
            platform: parsed.platform,
            source: meta?.source ?? "ENV",
            tokenUrl: meta?.tokenUrl,
        });
    }
    catch (e) {
        return server_1.NextResponse.json({ ok: false, shopId: shop.id, error: e?.message || "Token exchange failed" }, { status: 500 });
    }
}
