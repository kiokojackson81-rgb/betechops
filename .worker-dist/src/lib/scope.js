"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveShopScope = resolveShopScope;
exports.resolveShopScopeForServer = resolveShopScopeForServer;
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
async function resolveShopScope() {
    var _a, _b, _c;
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        const roleStr = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
        const email = ((_c = (_b = session === null || session === void 0 ? void 0 : session.user) === null || _b === void 0 ? void 0 : _b.email) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || "";
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
    catch (_d) {
        return {};
    }
}
// Server components/pages variant (no Request available)
async function resolveShopScopeForServer() {
    var _a, _b;
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        const roleStr = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
        const role = mapRole(roleStr);
        const email = (((_b = session === null || session === void 0 ? void 0 : session.user) === null || _b === void 0 ? void 0 : _b.email) || "").toLowerCase();
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
    catch (_c) {
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
