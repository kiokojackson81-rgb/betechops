"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
async function POST(req) {
    try {
        const text = await req.text();
        JSON.parse(text || "{}");
        return server_1.NextResponse.json({ ok: true });
    }
    catch (e) {
        return server_1.NextResponse.json({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || "Invalid JSON" }, { status: 400 });
    }
}
