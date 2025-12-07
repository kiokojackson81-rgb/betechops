"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET() {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const accounts = await prisma_1.prisma.marketplaceAccount.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: {
            assignments: {
                include: {
                    attendant: {
                        select: { id: true, name: true, email: true },
                    },
                },
            },
        },
    });
    return server_1.NextResponse.json({ accounts });
}
async function POST(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    let payload = null;
    try {
        payload = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!payload?.displayName || !payload.platform || !payload.countryCode) {
        return server_1.NextResponse.json({ error: "platform, displayName and countryCode are required" }, { status: 400 });
    }
    const data = {
        platform: payload.platform,
        displayName: payload.displayName.trim(),
        countryCode: payload.countryCode.trim(),
        currency: payload.currency?.trim() || "KES",
        jumiaShopSid: payload.jumiaShopSid?.trim() || null,
        kilimallShopCode: payload.kilimallShopCode?.trim() || null,
        isActive: payload.isActive ?? true,
    };
    const record = payload.id
        ? await prisma_1.prisma.marketplaceAccount.update({ where: { id: payload.id }, data })
        : await prisma_1.prisma.marketplaceAccount.create({ data });
    return server_1.NextResponse.json({ account: record });
}
