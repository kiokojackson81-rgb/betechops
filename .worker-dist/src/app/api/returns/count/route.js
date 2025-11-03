"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
async function GET(req) {
    try {
        const status = req.nextUrl.searchParams.get("status");
        // TODO: switch on status when you build real DB logic
        return server_1.NextResponse.json({ count: status === "waiting-pickup" ? 2 : 0 });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ count: 0, error: msg }, { status: 200 });
    }
}
