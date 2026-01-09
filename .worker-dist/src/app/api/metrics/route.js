"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const metrics_1 = require("@/lib/metrics");
async function GET() {
    try {
        const body = await (0, metrics_1.getMetrics)();
        return new server_1.NextResponse(body, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; version=0.0.4' },
        });
    }
    catch (err) {
        return new server_1.NextResponse(String(err), { status: 500 });
    }
}
