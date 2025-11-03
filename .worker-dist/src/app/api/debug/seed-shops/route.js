"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const client_1 = require("@prisma/client");
const secure_json_1 = require("@/lib/crypto/secure-json");
const prisma = new client_1.PrismaClient();
exports.dynamic = "force-dynamic";
/**
 * POST /api/debug/seed-shops?token=SETUP_TOKEN
 * Body: { shops: IncomingShop[] }
 *
 * Safely upserts multiple Jumia shops by name with per-shop credentials.
 * Stores credentials in Shop.credentialsEncrypted (encrypted when SECURE_JSON_KEY is set).
 */
async function POST(req) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || req.headers.get("x-setup-token");
    const expected = process.env.SETUP_TOKEN;
    if (!expected || !token || token !== expected) {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let body;
    try {
        body = (await req.json());
    }
    catch (_a) {
        return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const shops = Array.isArray(body.shops) ? body.shops : [];
    if (!shops.length)
        return server_1.NextResponse.json({ ok: false, error: "No shops provided" }, { status: 400 });
    const results = [];
    for (const s of shops) {
        const name = String(s.name || "").trim();
        if (!name || !s.clientId || !s.refreshToken) {
            results.push({ name: name || "(missing)", action: "skipped", error: "name, clientId, refreshToken required" });
            continue;
        }
        const apiBase = (s.apiBase || process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE || "https://vendor-api.jumia.com").replace(/\/?$/, "");
        const tokenUrl = s.tokenUrl || process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL || `${new URL(apiBase).origin}/token`;
        const creds = {
            platform: "JUMIA",
            apiBase,
            tokenUrl,
            clientId: s.clientId,
            refreshToken: s.refreshToken,
            vendorShopId: s.shopId,
        };
        // Encrypt when key is present; else store plaintext JSON (for dev only)
        let credentialsEncrypted = null;
        try {
            if (process.env.SECURE_JSON_KEY)
                credentialsEncrypted = (0, secure_json_1.encryptJsonForStorage)(creds);
            else
                credentialsEncrypted = creds;
        }
        catch (_b) {
            credentialsEncrypted = creds;
        }
        try {
            const existing = await prisma.shop.findFirst({ where: { name } });
            const data = {
                name,
                platform: client_1.Platform.JUMIA,
                isActive: true,
                credentialsEncrypted,
            };
            if (existing) {
                const updated = await prisma.shop.update({ where: { id: existing.id }, data });
                results.push({ name, action: "updated", id: updated.id });
            }
            else {
                const created = await prisma.shop.create({ data });
                results.push({ name, action: "created", id: created.id });
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            results.push({ name, action: "skipped", error: msg });
        }
    }
    return server_1.NextResponse.json({ ok: true, results });
}
