"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const client_1 = require("@/lib/jumia/client");
const API_BASE = "https://vendor-api.jumia.com";
const TOKEN_URL = "https://vendor-api.jumia.com/token";
async function requireAdmin() {
    var _a;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== "ADMIN") {
        throw new server_1.NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
}
// Next 15 route handlers: context is an object whose params is a Promise
async function POST(_request, context) {
    var _a;
    try {
        await requireAdmin();
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    const { params } = context;
    const { id: accountId } = await params;
    if (!accountId) {
        return server_1.NextResponse.json({ error: "Missing account id" }, { status: 400 });
    }
    const account = await prisma_1.prisma.jumiaAccount.findUnique({ where: { id: accountId } });
    if (!account) {
        return server_1.NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const client = new client_1.JumiaClient(API_BASE, TOKEN_URL, account.clientId, account.refreshToken, async (rotated) => {
        await prisma_1.prisma.jumiaAccount.update({
            where: { id: account.id },
            data: { refreshToken: rotated },
        });
    });
    try {
        const payload = await client.getShops();
        const shops = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.shops) ? payload.shops : [];
        await Promise.all(shops.map((shop) => prisma_1.prisma.jumiaShop.upsert({
            where: { id: shop.id },
            create: {
                id: shop.id,
                name: shop.name,
                accountId: account.id,
            },
            update: {
                name: shop.name,
                accountId: account.id,
            },
        })));
        await prisma_1.prisma.jumiaShop.deleteMany({
            where: {
                accountId: account.id,
                id: { notIn: shops.map((shop) => shop.id) },
            },
        });
        const refreshed = await prisma_1.prisma.jumiaAccount.findUnique({
            where: { id: account.id },
            include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
        });
        return server_1.NextResponse.json({
            ok: true,
            shops: (_a = refreshed === null || refreshed === void 0 ? void 0 : refreshed.shops) !== null && _a !== void 0 ? _a : [],
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to discover shops";
        return server_1.NextResponse.json({ error: message }, { status: 500 });
    }
}
