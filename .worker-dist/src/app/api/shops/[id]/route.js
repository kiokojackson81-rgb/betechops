"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const secure_json_1 = require("@/lib/crypto/secure-json");
const api_1 = require("@/lib/api");
async function PATCH(request, { params }) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const { id } = await params;
    const body = (await request.json().catch(() => ({})));
    const { name, isActive, credentials } = body;
    const data = {};
    if (name !== undefined)
        data.name = name;
    if (isActive !== undefined)
        data.isActive = Boolean(isActive);
    if (credentials !== undefined)
        data.credentialsEncrypted = (0, secure_json_1.encryptJsonForStorage)(credentials);
    const shop = await prisma_1.prisma.shop.update({ where: { id }, data: data });
    return server_1.NextResponse.json(shop);
}
async function GET(request, { params }) {
    const auth = await (0, api_1.requireRole)(['ADMIN', 'SUPERVISOR']);
    if (!auth.ok)
        return auth.res;
    const { id } = await params;
    const shop = await prisma_1.prisma.shop.findUnique({ where: { id } });
    if (!shop)
        return server_1.NextResponse.json({ error: 'Not found' }, { status: 404 });
    // return a safe subset (do not return credentialsEncrypted)
    const rest = {
        id: shop.id,
        name: shop.name,
        platform: shop.platform,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
        email: shop.email,
        phone: shop.phone,
        location: shop.location,
    };
    return server_1.NextResponse.json(rest);
}
