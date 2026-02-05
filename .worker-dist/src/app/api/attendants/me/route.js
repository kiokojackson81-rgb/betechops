"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const resolveTargetUser_1 = require("@/lib/resolveTargetUser");
async function GET(req) {
    const identity = await (0, resolveTargetUser_1.resolveTargetUserId)(req, { allowedImpersonationRoles: ["ADMIN"] });
    const meta = identity;
    const targetUserId = identity.resolvedUserId;
    if (!targetUserId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            attendantCategory: true,
            isActive: true,
            categoryAssignments: { select: { category: true } },
        },
    });
    if (!user)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    const { categoryAssignments, ...rest } = user;
    const impersonated = Boolean(identity.impersonateId && identity.resolvedUserId === identity.impersonateId);
    const payload = {
        user: { ...rest, categories: categoryAssignments.map((c) => c.category) },
        impersonated,
        impersonatedBy: impersonated ? identity.actorRole ?? null : null,
    };
    return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, payload));
}
