"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jobs/jumia");
async function POST() {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    try {
        const summary = await (0, jumia_1.syncReturnOrders)();
        return (0, api_1.noStoreJson)({ ok: true, summary });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 500 });
    }
}
