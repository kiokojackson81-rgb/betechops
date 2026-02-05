"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
async function GET(req) {
    const adminKey = process.env.ADMIN_DEBUG_KEY || '';
    const provided = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key') || '';
    if (!adminKey || provided !== adminKey) {
        return server_1.NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id)
        return server_1.NextResponse.json({ error: 'missing id' }, { status: 400 });
    try {
        const file = await prisma_1.prisma.receiptFile.findFirst({ where: { receiptId: id }, orderBy: { uploadedAt: 'desc' } });
        if (!file)
            return server_1.NextResponse.json({ error: 'not_found' }, { status: 404 });
        const out = {
            id: file.id,
            url: file.url,
            key: file.key,
            uploadedAt: file.uploadedAt,
            contentType: file.contentType,
            size: file.size,
        };
        return server_1.NextResponse.json(out);
    }
    catch (e) {
        return server_1.NextResponse.json({ error: 'server_error', detail: String(e) }, { status: 500 });
    }
}
