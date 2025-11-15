"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET() {
    const auth = await (0, api_1.requireRole)(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const actorId = await (0, api_1.getActorId)();
    if (!actorId)
        return server_1.NextResponse.json([], { status: 200 });
    const where = auth.role === "ADMIN"
        ? { isActive: true }
        : {
            isActive: true,
            OR: [
                { assignments: { some: { userId: actorId } } },
                { userAssignments: { some: { userId: actorId } } },
            ],
        };
    const shops = await prisma_1.prisma.shop.findMany({
        where,
        select: { id: true, name: true, platform: true },
        orderBy: { name: "asc" },
    });
    return server_1.NextResponse.json(shops);
}
