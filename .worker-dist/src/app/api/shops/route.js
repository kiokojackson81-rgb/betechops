"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
// app/api/shops/route.ts
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const secure_json_1 = require("@/lib/crypto/secure-json");
const api_1 = require("@/lib/api");
const zod_1 = require("zod");
exports.dynamic = "force-dynamic";
async function GET() {
    const shops = await prisma_1.prisma.shop.findMany({ orderBy: { name: "asc" } });
    return server_1.NextResponse.json(shops);
}
async function POST(request) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    try {
        const body = (await request.json().catch(() => null));
        if (!body) {
            return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { name, platform, credentials } = body;
        const CredSchema = zod_1.z.object({
            platform: zod_1.z.enum(["JUMIA", "KILIMALL"]).optional(),
            apiBase: zod_1.z.string().url().optional(),
            base_url: zod_1.z.string().url().optional(),
            tokenUrl: zod_1.z.string().url(),
            clientId: zod_1.z.string().min(6),
            refreshToken: zod_1.z.string().min(10),
            authType: zod_1.z.enum(["SELF_AUTHORIZATION"]).default("SELF_AUTHORIZATION"),
            shopLabel: zod_1.z.string().optional(),
        }).passthrough();
        const CreateShopSchema = zod_1.z.object({
            name: zod_1.z.string().min(2),
            platform: zod_1.z.enum(["JUMIA", "KILIMALL"]),
            credentials: CredSchema,
        });
        if (!name)
            return server_1.NextResponse.json({ error: 'name is required' }, { status: 400 });
        const parsed = CreateShopSchema.safeParse({ name, platform, credentials });
        if (!parsed.success) {
            return server_1.NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const encrypted = parsed.data.credentials ? (0, secure_json_1.encryptJsonForStorage)(parsed.data.credentials) : null;
        const shop = await prisma_1.prisma.shop.create({ data: { name: parsed.data.name, platform: parsed.data.platform, credentialsEncrypted: encrypted } });
        return server_1.NextResponse.json({ shop }, { status: 201 });
    }
    catch (e) {
        // Ensure we always return JSON from this route (avoid HTML error pages)
        const msg = typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e ?? 'Server error');
        console.error("POST /api/shops failed:", e);
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
