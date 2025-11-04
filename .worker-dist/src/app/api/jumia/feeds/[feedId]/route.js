"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
async function GET(_req, context) {
    const { feedId } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const data = await (0, jumia_1.getFeedById)(feedId).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    return (0, api_1.noStoreJson)(data);
}
