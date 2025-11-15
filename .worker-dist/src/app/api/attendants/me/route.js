"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
async function GET() {
    const session = await (0, auth_1.auth)();
    const email = session?.user?.email?.toLowerCase();
    if (!email)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
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
    return server_1.NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
}
