"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function requireAdmin() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN") {
        throw new server_1.NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
}
async function GET() {
    try {
        await requireAdmin();
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    const accounts = await prisma_1.prisma.jumiaAccount.findMany({
        include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
        orderBy: { createdAt: "desc" },
    });
    const data = accounts.map((acc) => ({
        id: acc.id,
        label: acc.label,
        clientId: acc.clientId,
        refreshToken: acc.refreshToken ? "********" : "",
        shops: acc.shops,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
    }));
    return server_1.NextResponse.json({ accounts: data });
}
async function POST(request) {
    try {
        await requireAdmin();
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    try {
        const body = (await request.json());
        const label = body.label?.trim();
        const clientId = body.clientId?.trim();
        const refreshTokenRaw = body.refreshToken?.trim();
        if (!label || !clientId) {
            return server_1.NextResponse.json({ error: "label and clientId are required" }, { status: 400 });
        }
        const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;
        let account;
        if (body.id) {
            account = await prisma_1.prisma.jumiaAccount.update({
                where: { id: body.id },
                data: {
                    label,
                    clientId,
                    ...(refreshToken ? { refreshToken } : {}),
                },
                include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
            });
        }
        else {
            if (!refreshToken) {
                return server_1.NextResponse.json({ error: "refreshToken is required for new accounts" }, { status: 400 });
            }
            account = await prisma_1.prisma.jumiaAccount.create({
                data: { label, clientId, refreshToken },
                include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
            });
        }
        return server_1.NextResponse.json({
            ok: true,
            account: {
                id: account.id,
                label: account.label,
                clientId: account.clientId,
                refreshToken: account.refreshToken ? "********" : "",
                shops: account.shops,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return server_1.NextResponse.json({ error: message }, { status: 500 });
    }
}
