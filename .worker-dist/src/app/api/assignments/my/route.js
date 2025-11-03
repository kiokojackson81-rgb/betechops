"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const assignments_1 = require("@/lib/assignments");
// TODO: replace with real auth extraction
async function requireAuth(req) {
    // placeholder: in production hook into your auth middleware
    return { id: (req.headers.get('x-user-id') || ''), role: (req.headers.get('x-user-role') || 'ATTENDANT') };
}
async function GET(req) {
    const user = await requireAuth(req);
    if (!user.id)
        return server_1.NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const shops = await (0, assignments_1.getUserShops)(user.id);
    return server_1.NextResponse.json({ shops });
}
