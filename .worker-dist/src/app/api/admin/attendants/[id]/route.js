"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
async function PATCH(request, { params }) {
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        if (!session)
            return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if ((session.user?.role ?? "") !== "ADMIN") {
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const id = params.id;
        const body = await request.json();
        const action = body?.action;
        if (!action || !["activate", "deactivate"].includes(action)) {
            return server_1.NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
        const isActive = action === "activate";
        const updated = await prisma_1.prisma.user.update({ where: { id }, data: { isActive } });
        return server_1.NextResponse.json({ id: updated.id, isActive: updated.isActive });
    }
    catch (err) {
        return server_1.NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
async function DELETE(_request, { params }) {
    try {
        const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
        if (!session)
            return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if ((session.user?.role ?? "") !== "ADMIN") {
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const id = params.id;
        await prisma_1.prisma.user.delete({ where: { id } });
        return server_1.NextResponse.json({ deleted: true });
    }
    catch (err) {
        return server_1.NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
