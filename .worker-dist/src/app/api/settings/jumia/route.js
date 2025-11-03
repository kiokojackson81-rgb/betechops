"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const SCOPE = "GLOBAL";
async function GET() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== "ADMIN")
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const c = await prisma_1.prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
    return server_1.NextResponse.json({
        // Prefer canonical base_url env var; fall back to legacy JUMIA_API_BASE
        apiBase: (_d = (_c = (_b = c === null || c === void 0 ? void 0 : c.apiBase) !== null && _b !== void 0 ? _b : process.env.base_url) !== null && _c !== void 0 ? _c : process.env.JUMIA_API_BASE) !== null && _d !== void 0 ? _d : "",
        issuer: (_g = (_f = (_e = c === null || c === void 0 ? void 0 : c.issuer) !== null && _e !== void 0 ? _e : process.env.OIDC_ISSUER) !== null && _f !== void 0 ? _f : process.env.JUMIA_OIDC_ISSUER) !== null && _g !== void 0 ? _g : "",
        // Prefer standard OIDC env name for client id
        clientId: (_k = (_j = (_h = c === null || c === void 0 ? void 0 : c.clientId) !== null && _h !== void 0 ? _h : process.env.OIDC_CLIENT_ID) !== null && _j !== void 0 ? _j : process.env.JUMIA_CLIENT_ID) !== null && _k !== void 0 ? _k : "",
        refreshToken: (c === null || c === void 0 ? void 0 : c.refreshToken) ? "********" : "",
        hasClientSecret: Boolean((_m = (_l = c === null || c === void 0 ? void 0 : c.apiSecret) !== null && _l !== void 0 ? _l : process.env.OIDC_CLIENT_SECRET) !== null && _m !== void 0 ? _m : process.env.JUMIA_CLIENT_SECRET),
    });
}
async function POST(req) {
    var _a, _b, _c, _d;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== "ADMIN")
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const b = (await req.json());
    const apiBase = String((_b = b.apiBase) !== null && _b !== void 0 ? _b : "");
    const issuer = String((_c = b.issuer) !== null && _c !== void 0 ? _c : "");
    const clientId = String((_d = b.clientId) !== null && _d !== void 0 ? _d : "");
    const clientSecretRaw = b.clientSecret ? String(b.clientSecret) : undefined;
    const refreshTokenRaw = b.refreshToken ? String(b.refreshToken) : undefined;
    const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;
    const clientSecret = clientSecretRaw && clientSecretRaw !== "********" ? clientSecretRaw : undefined;
    const existing = await prisma_1.prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
    if (existing) {
        const updateData = Object.assign(Object.assign({ apiBase,
            issuer,
            clientId }, (refreshToken ? { refreshToken } : {})), (clientSecret ? { apiSecret: clientSecret } : {}));
        await prisma_1.prisma.apiCredential.update({ where: { id: existing.id }, data: updateData });
    }
    else {
        const createData = Object.assign({ scope: SCOPE, apiBase, apiKey: "", apiSecret: clientSecret !== null && clientSecret !== void 0 ? clientSecret : "", issuer,
            clientId }, (refreshToken ? { refreshToken } : {}));
        await prisma_1.prisma.apiCredential.create({ data: createData });
    }
    return server_1.NextResponse.json({ ok: true });
}
