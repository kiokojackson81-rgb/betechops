"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const KEY = "commission_window";
async function GET() {
    var _a, _b, _c;
    const row = await prisma_1.prisma.config.findUnique({ where: { key: KEY } });
    const json = (row === null || row === void 0 ? void 0 : row.json) || {};
    return server_1.NextResponse.json({
        fromDay: Number((_a = json.fromDay) !== null && _a !== void 0 ? _a : 24),
        toDay: Number((_b = json.toDay) !== null && _b !== void 0 ? _b : 24),
        adminEmails: String((_c = json.adminEmails) !== null && _c !== void 0 ? _c : (process.env.ADMIN_EMAILS || "")),
    });
}
async function POST(req) {
    const b = (await req.json());
    const json = {
        fromDay: Math.min(28, Math.max(1, Number(b.fromDay || 24))),
        toDay: Math.min(28, Math.max(1, Number(b.toDay || 24))),
        adminEmails: String(b.adminEmails || ""),
    };
    await prisma_1.prisma.config.upsert({
        where: { key: KEY },
        update: { json },
        create: { key: KEY, json },
    });
    return server_1.NextResponse.json({ ok: true });
}
