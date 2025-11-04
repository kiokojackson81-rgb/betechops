"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    try {
        const url = new URL(req.url);
        const q = (url.searchParams.get("q") || "").trim();
        if (!q)
            return server_1.NextResponse.json([], { status: 200 });
        const users = await prisma_1.prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                ],
            },
            take: 10,
            select: { id: true, name: true, email: true },
        });
        return server_1.NextResponse.json(users);
    }
    catch {
        return server_1.NextResponse.json({ error: "search_failed" }, { status: 500 });
    }
}
