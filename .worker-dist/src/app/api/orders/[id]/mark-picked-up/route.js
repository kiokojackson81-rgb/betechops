"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
async function POST(_, { params }) {
    try {
        const { id } = await params;
        const updated = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                status: "FULFILLED", // picked up
                updatedAt: new Date(),
            },
        });
        return server_1.NextResponse.json({ ok: true, id: updated.id });
    }
    catch (e) {
        console.error("mark-picked-up error:", e);
        return server_1.NextResponse.json({ error: "Failed to mark picked up" }, { status: 500 });
    }
}
