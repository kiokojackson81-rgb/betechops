"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function GET(request) {
    const guard = await (0, auth_1.requireAttendant)(request);
    if (!guard.ok) {
        return guard.res;
    }
    const staff = await prisma_1.prisma.user.findMany({
        where: {
            role: { in: ["ATTENDANT", "SUPERVISOR"] },
            isActive: true,
        },
        orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            email: true,
            attendantCategory: true,
        },
    });
    return server_1.NextResponse.json(staff.map((member) => ({
        id: member.id,
        name: member.name || member.email || "Unnamed",
        email: member.email,
        attendantCategory: member.attendantCategory,
    })));
}
