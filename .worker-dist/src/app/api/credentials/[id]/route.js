"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function PATCH(request, { params }) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const { id } = await params;
    const body = (await request.json().catch(() => ({})));
    const data = {};
    if (body.scope !== undefined)
        data.scope = body.scope;
    if (body.apiBase !== undefined)
        data.apiBase = body.apiBase;
    if (body.apiKey !== undefined)
        data.apiKey = body.apiKey;
    if (body.apiSecret !== undefined)
        data.apiSecret = body.apiSecret;
    if (body.issuer !== undefined)
        data.issuer = body.issuer;
    if (body.clientId !== undefined)
        data.clientId = body.clientId;
    if (body.refreshToken !== undefined)
        data.refreshToken = body.refreshToken;
    if (body.shopId !== undefined)
        data.shop = { connect: { id: body.shopId } };
    const updated = await prisma_1.prisma.apiCredential.update({ where: { id }, data });
    return server_1.NextResponse.json(updated);
}
async function DELETE(request, { params }) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const { id } = await params;
    await prisma_1.prisma.apiCredential.delete({ where: { id } });
    return server_1.NextResponse.json({ ok: true });
}
