"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
exports.noStoreJson = noStoreJson;
exports.getActorId = getActorId;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
async function requireRole(min) {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (!role)
        return { ok: false, res: server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const allowed = Array.isArray(min) ? min : [min];
    if (!allowed.includes(role))
        return { ok: false, res: server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { ok: true, role, session };
}
function noStoreJson(data, init) {
    const res = server_1.NextResponse.json(data, init);
    res.headers.set("Cache-Control", "no-store");
    return res;
}
async function getActorId() {
    try {
        const session = await (0, auth_1.auth)();
        const email = session?.user?.email?.toLowerCase() || "";
        if (!email)
            return null;
        const user = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } });
        return user?.id || null;
    }
    catch {
        return null;
    }
}
