"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
async function GET() {
    try {
        const { count } = await (0, jumia_1.getPendingPricingCount)();
        return server_1.NextResponse.json({ count });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ count: 0, error: msg }, { status: 200 });
    }
}
