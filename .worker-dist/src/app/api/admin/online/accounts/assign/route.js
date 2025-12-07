"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    let payload = null;
    try {
        payload = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!payload?.accountId || !payload.attendantId || !payload.role) {
        return server_1.NextResponse.json({ error: "accountId, attendantId and role are required" }, { status: 400 });
    }
    const assignment = await prisma_1.prisma.marketplaceAccountAssignment.upsert({
        where: {
            accountId_attendantId_role: {
                accountId: payload.accountId,
                attendantId: payload.attendantId,
                role: payload.role,
            },
        },
        create: {
            accountId: payload.accountId,
            attendantId: payload.attendantId,
            role: payload.role,
            endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        },
        update: {
            endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        },
    });
    return server_1.NextResponse.json({ assignment });
}
