"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET() {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const creds = await prisma_1.prisma.apiCredential.findMany({ orderBy: { createdAt: 'desc' } });
    return server_1.NextResponse.json(creds);
}
async function POST(request) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const body = (await request.json().catch(() => ({})));
    const { scope = 'GLOBAL', apiBase = '', apiKey, apiSecret, issuer, clientId, refreshToken, shopId } = body;
    const created = await prisma_1.prisma.apiCredential.create({ data: { scope, apiBase, apiKey, apiSecret, issuer, clientId, refreshToken, shopId } });
    return server_1.NextResponse.json(created, { status: 201 });
}
