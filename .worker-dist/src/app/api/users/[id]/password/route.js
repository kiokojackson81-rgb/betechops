"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function POST(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const pathname = new URL(request.url).pathname;
    const id = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (!id)
        return server_1.NextResponse.json({ error: "missing_id" }, { status: 400 });
    const body = (await request.json().catch(() => ({})));
    const newPassword = body.password || "";
    if (!newPassword || newPassword.length < 6)
        return server_1.NextResponse.json({ error: "password_too_short" }, { status: 400 });
    try {
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({ where: { id }, data: { password: hashed } });
        return server_1.NextResponse.json({ ok: true });
    }
    catch (err) {
        return server_1.NextResponse.json({ error: "update_failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
