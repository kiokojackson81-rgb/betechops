"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function POST(request) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const body = (await request.json().catch(() => ({})));
    const { email, name, role } = body;
    if (!email)
        return server_1.NextResponse.json({ error: 'email required' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const up = await prisma_1.prisma.user.upsert({
        where: { email: normalizedEmail },
        update: { name: name !== null && name !== void 0 ? name : undefined, role: role !== null && role !== void 0 ? role : undefined, isActive: true },
        create: { email: normalizedEmail, name: name !== null && name !== void 0 ? name : normalizedEmail.split('@')[0], role: role !== null && role !== void 0 ? role : 'ATTENDANT', isActive: true },
    });
    return server_1.NextResponse.json({ ok: true, user: up }, { status: 201 });
}
