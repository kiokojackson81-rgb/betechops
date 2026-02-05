"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
async function GET() {
    const s = await (0, auth_1.auth)();
    const sess = s;
    return server_1.NextResponse.json({ email: sess?.user?.email ?? null, role: sess?.user?.role ?? null });
}
