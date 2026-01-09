"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
exports.dynamic = 'force-dynamic';
async function GET(req) {
    const guard = await (0, api_1.requireRole)(['ADMIN']);
    if (!guard.ok)
        return guard.res;
    const url = new URL(req.url);
    const receiptId = url.searchParams.get('receiptId') || undefined;
    const where = {};
    if (receiptId)
        where.receiptId = receiptId;
    const files = await prisma_1.prisma.receiptFile.findMany({ where, orderBy: { uploadedAt: 'desc' } });
    return server_1.NextResponse.json({ files });
}
