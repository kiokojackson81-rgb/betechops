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
        if (email) {
            const user = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (user?.id)
                return user.id;
        }
        // Fallback: ensure a system actor exists. Prefer `SYSTEM_USER_EMAIL` when
        // configured, otherwise create/find a local internal system user so that
        // server processes can always write ActionLog entries without using the
        // literal string 'system' which violates the DB foreign key.
        const configured = (process.env.SYSTEM_USER_EMAIL || "").toLowerCase().trim();
        const sysEmail = configured || 'system@betech.internal';
        let sysUser = await prisma_1.prisma.user.findUnique({ where: { email: sysEmail }, select: { id: true } });
        if (!sysUser) {
            try {
                sysUser = await prisma_1.prisma.user.create({
                    data: {
                        email: sysEmail,
                        name: "System",
                        role: "ADMIN",
                        isActive: true,
                        attendantCategory: process.env.DEFAULT_SYSTEM_CATEGORY ?? "DIRECT_SALES_OPS",
                    },
                    select: { id: true },
                });
            }
            catch (createErr) {
                // If creation fails (race or DB restriction), attempt to read again
                sysUser = await prisma_1.prisma.user.findUnique({ where: { email: sysEmail }, select: { id: true } });
            }
        }
        return sysUser?.id || null;
    }
    catch {
        return null;
    }
}
