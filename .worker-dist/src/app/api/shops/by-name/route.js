"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
// GET /api/shops/by-name?name=JM%20Collection&platform=JUMIA
async function GET(req) {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    const platformParam = url.searchParams.get("platform");
    if (!name || !name.trim()) {
        return server_1.NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    // Optional platform filter, limited to known enum values
    const platform = (platformParam === "JUMIA" || platformParam === "KILIMALL")
        ? platformParam
        : undefined;
    const where = {
        name: { equals: name.trim(), mode: "insensitive" },
        ...(platform ? { platform } : {}),
    };
    try {
        const shop = await prisma_1.prisma.shop.findFirst({
            where,
            select: { id: true, name: true, platform: true, isActive: true },
        });
        if (!shop) {
            return server_1.NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
        }
        return server_1.NextResponse.json({ ok: true, shop });
    }
    catch (e) {
        const msg = typeof e === "object" && e !== null && "message" in e
            ? String(e.message)
            : String(e ?? "Server error");
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
