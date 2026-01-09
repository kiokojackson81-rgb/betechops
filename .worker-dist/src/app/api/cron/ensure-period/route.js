"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const commission_1 = require("@/lib/commission");
const timezone_1 = require("@/lib/timezone");
exports.dynamic = "force-dynamic";
async function GET() {
    const today = (0, timezone_1.nowInNairobi)();
    await (0, commission_1.getOrCreateCommissionPeriod)(today);
    return server_1.NextResponse.json({ ok: true, date: today.toISOString() });
}
