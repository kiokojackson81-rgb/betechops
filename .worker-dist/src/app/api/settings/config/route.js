"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const KEY = "commission_window";
async function GET() {
    const row = await prisma_1.prisma.config.findUnique({ where: { key: KEY } });
    const json = row?.json || {};
    return server_1.NextResponse.json({
        fromDay: Number(json.fromDay ?? 24),
        toDay: Number(json.toDay ?? 24),
        adminEmails: String(json.adminEmails ?? (process.env.ADMIN_EMAILS || "")),
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
