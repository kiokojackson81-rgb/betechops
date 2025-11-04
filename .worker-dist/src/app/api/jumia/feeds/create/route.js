"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    let payload;
    try {
        payload = await req.json();
    }
    catch {
        return (0, api_1.noStoreJson)({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
        return (0, api_1.noStoreJson)({ ok: false, error: "Payload must be an object" }, { status: 400 });
    }
    try {
        const result = await (0, jumia_1.postFeedProductsCreate)(payload);
        return (0, api_1.noStoreJson)({ ok: true, result });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 502 });
    }
}
