"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const SCOPE = "GLOBAL";
async function GET() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN")
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const c = await prisma_1.prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
    return server_1.NextResponse.json({
        // Prefer canonical base_url env var; fall back to legacy JUMIA_API_BASE
        apiBase: c?.apiBase ?? process.env.base_url ?? process.env.JUMIA_API_BASE ?? "",
        issuer: c?.issuer ?? process.env.OIDC_ISSUER ?? process.env.JUMIA_OIDC_ISSUER ?? "",
        // Prefer standard OIDC env name for client id
        clientId: c?.clientId ?? process.env.OIDC_CLIENT_ID ?? process.env.JUMIA_CLIENT_ID ?? "",
        refreshToken: c?.refreshToken ? "********" : "",
        hasClientSecret: Boolean(c?.apiSecret ?? process.env.OIDC_CLIENT_SECRET ?? process.env.JUMIA_CLIENT_SECRET),
    });
}
async function POST(req) {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN")
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const b = (await req.json());
    const apiBase = String(b.apiBase ?? "");
    const issuer = String(b.issuer ?? "");
    const clientId = String(b.clientId ?? "");
    const clientSecretRaw = b.clientSecret ? String(b.clientSecret) : undefined;
    const refreshTokenRaw = b.refreshToken ? String(b.refreshToken) : undefined;
    const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;
    const clientSecret = clientSecretRaw && clientSecretRaw !== "********" ? clientSecretRaw : undefined;
    const existing = await prisma_1.prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
    if (existing) {
        const updateData = {
            apiBase,
            issuer,
            clientId,
            ...(refreshToken ? { refreshToken } : {}),
            ...(clientSecret ? { apiSecret: clientSecret } : {}),
        };
        await prisma_1.prisma.apiCredential.update({ where: { id: existing.id }, data: updateData });
    }
    else {
        const createData = {
            scope: SCOPE,
            apiBase,
            apiKey: "",
            apiSecret: clientSecret ?? "",
            issuer,
            clientId,
            ...(refreshToken ? { refreshToken } : {}),
        };
        await prisma_1.prisma.apiCredential.create({ data: createData });
    }
    return server_1.NextResponse.json({ ok: true });
}
