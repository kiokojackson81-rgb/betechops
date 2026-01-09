"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const oidc_1 = require("@/lib/oidc");
const oidc_2 = require("@/lib/oidc");
async function POST(req) {
    const json = await req.json().catch(() => ({}));
    const parsed = oidc_1.ShopAuthSchema.partial().parse(json ?? {});
    const token = await (0, oidc_2.getJumiaAccessToken)(parsed);
    return server_1.NextResponse.json({
        source: token._meta?.source,
        platform: token._meta?.platform ?? "JUMIA",
        tokenUrl: token._meta?.tokenUrl,
    });
}
