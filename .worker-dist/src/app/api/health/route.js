"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
// src/app/api/health/route.ts
const server_1 = require("next/server");
const health_1 = require("@/lib/health");
async function GET() {
    const payload = await (0, health_1.computeHealth)();
    return server_1.NextResponse.json(payload);
}
