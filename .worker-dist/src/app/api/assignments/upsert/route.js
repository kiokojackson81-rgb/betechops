"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const assignments_1 = require("@/lib/assignments");
// TODO: replace with real auth extraction & permission checks
async function requireAuth(req) {
    return { id: (req.headers.get('x-user-id') || ''), role: (req.headers.get('x-user-role') || 'SUPERVISOR') };
}
async function POST(req) {
    const user = await requireAuth(req);
    if (!user.id)
        return server_1.NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    // Only supervisors/admins allowed
    if (!['SUPERVISOR', 'ADMIN'].includes(user.role))
        return server_1.NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const body = await req.json();
    const { userId, entries } = body;
    if (!userId)
        return server_1.NextResponse.json({ error: 'userId required' }, { status: 400 });
    await (0, assignments_1.upsertAssignments)(userId, entries || []);
    return server_1.NextResponse.json({ ok: true });
}
