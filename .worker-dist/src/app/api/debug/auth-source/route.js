"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const oidc_1 = require("@/lib/oidc");
const oidc_2 = require("@/lib/oidc");
async function POST(req) {
    var _a, _b, _c, _d;
    const json = await req.json().catch(() => ({}));
    const parsed = oidc_1.ShopAuthSchema.partial().parse(json !== null && json !== void 0 ? json : {});
    const token = await (0, oidc_2.getJumiaAccessToken)(parsed);
    return server_1.NextResponse.json({
        source: (_a = token._meta) === null || _a === void 0 ? void 0 : _a.source,
        platform: (_c = (_b = token._meta) === null || _b === void 0 ? void 0 : _b.platform) !== null && _c !== void 0 ? _c : "JUMIA",
        tokenUrl: (_d = token._meta) === null || _d === void 0 ? void 0 : _d.tokenUrl,
    });
}
