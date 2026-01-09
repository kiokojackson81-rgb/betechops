"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    // Return a small operational summary placeholder. The frontend callers
    // can handle empty/missing values; this file exists primarily so the
    // build has a concrete handler to type-check against.
    return server_1.NextResponse.json({ ok: true, message: "Online summary placeholder" });
}
