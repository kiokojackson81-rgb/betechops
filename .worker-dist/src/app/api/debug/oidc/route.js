"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
const oidc_1 = require("@/lib/oidc");
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const test = searchParams.get("test") === "true";
    const diag = await (0, jumia_1.diagnoseOidc)({ test });
    const tokenInfo = (0, oidc_1.getJumiaTokenInfo)();
    const payload = {
        issuer: diag.issuer,
        clientIdSet: diag.clientIdSet,
        hasClientSecret: diag.hasClientSecret,
        hasRefreshToken: diag.hasRefreshToken,
        tokenUrl: tokenInfo.tokenUrl || null,
    };
    if (test) {
        // attempt to mint and report success/ttl, but do not return token
        try {
            const now = Date.now();
            await (0, oidc_1.getJumiaAccessToken)();
            const info = (0, oidc_1.getJumiaTokenInfo)();
            const expiresIn = info.expiresAt ? Math.max(0, Math.floor((info.expiresAt - now) / 1000)) : undefined;
            payload.mintOk = true;
            payload.expiresIn = expiresIn;
        }
        catch (e) {
            payload.mintOk = false;
            payload.mintError = e instanceof Error ? e.message : String(e);
        }
    }
    if (diag.test)
        payload.test = diag.test;
    return server_1.NextResponse.json(payload);
}
