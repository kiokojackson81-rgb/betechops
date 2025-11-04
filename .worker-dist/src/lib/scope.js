"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveShopScope = resolveShopScope;
exports.resolveShopScopeForServer = resolveShopScopeForServer;
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
async function resolveShopScope() {
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        const roleStr = session?.user?.role;
        const email = session?.user?.email?.toLowerCase() || "";
        const role = mapRole(roleStr);
        if (!role || role === client_1.Role.ADMIN)
            return { role };
        if (!email)
            return { role };
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            select: { role: true, managedShops: { select: { id: true } } },
        });
        if (!user)
            return { role };
        return { role: user.role, shopIds: (user.managedShops || []).map(s => s.id) };
    }
    catch {
        return {};
    }
}
// Server components/pages variant (no Request available)
async function resolveShopScopeForServer() {
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        const roleStr = session?.user?.role;
        const role = mapRole(roleStr);
        const email = (session?.user?.email || "").toLowerCase();
        if (!role || role === client_1.Role.ADMIN)
            return { role };
        if (!email)
            return { role };
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            select: { role: true, managedShops: { select: { id: true } } },
        });
        if (!user)
            return { role };
        return { role: user.role, shopIds: (user.managedShops || []).map(s => s.id) };
    }
    catch {
        return {};
    }
}
function mapRole(role) {
    switch (role) {
        case "ADMIN": return client_1.Role.ADMIN;
        case "SUPERVISOR": return client_1.Role.SUPERVISOR;
        case "ATTENDANT": return client_1.Role.ATTENDANT;
        default: return undefined;
    }
}
