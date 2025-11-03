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
 * POST /api/debug/seed-shop?token=SETUP_TOKEN
 * Body: {
 *   name: string,
 *   platform?: "JUMIA"|"KILIMALL",
 *   // credentials JSON (apiBase/base_url, tokenUrl, clientId, refreshToken, ...)
 *   credentials: Record<string, unknown>
 * }
 *
 * Guards:
 * - Requires query ?token= to match process.env.SETUP_TOKEN
 * - Writes or updates a Shop by name, storing credentials (encrypted when SECURE_JSON_KEY set)
 */
async function POST(req) {
    var _a, _b;
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
    catch (_c) {
        return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const name = (body.name || body.shopLabel || "JM Collection").trim();
    const platformKey = (body.platform || "JUMIA");
    const platform = (_a = client_1.Platform[platformKey]) !== null && _a !== void 0 ? _a : client_1.Platform.JUMIA;
    const creds = (_b = body.credentials) !== null && _b !== void 0 ? _b : {};
    // If we have SECURE_JSON_KEY, store encrypted; otherwise store plaintext JSON
    let credentialsEncrypted = null;
    try {
        if (process.env.SECURE_JSON_KEY) {
            credentialsEncrypted = (0, secure_json_1.encryptJsonForStorage)(creds);
        }
        else {
            credentialsEncrypted = creds;
        }
    }
    catch (_d) {
        credentialsEncrypted = creds;
    }
    const existing = await prisma.shop.findFirst({ where: { name } });
    const data = {
        name,
        platform,
        isActive: true,
        credentialsEncrypted,
    };
    if (existing) {
        const updated = await prisma.shop.update({ where: { id: existing.id }, data });
        return server_1.NextResponse.json({ ok: true, action: "updated", shop: updated });
    }
    const created = await prisma.shop.create({ data });
    return server_1.NextResponse.json({ ok: true, action: "created", shop: created });
}
