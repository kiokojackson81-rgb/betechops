"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
async function GET() {
    try {
        const { total } = await (0, jumia_1.getSalesToday)();
        return server_1.NextResponse.json({ total });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ total: 0, error: msg }, { status: 200 });
    }
}
