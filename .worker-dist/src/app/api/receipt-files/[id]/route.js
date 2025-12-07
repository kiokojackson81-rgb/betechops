"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const storage_1 = require("@/lib/storage");
exports.dynamic = 'force-dynamic';
// Accept both direct and Promise-based params (Next 16 typed context)
async function DELETE(req, context) {
    const guard = await (0, api_1.requireRole)(['ADMIN']);
    if (!guard.ok)
        return guard.res;
    const { id } = 'params' in context && typeof context.params?.then === 'function'
        ? await context.params
        : context.params;
    try {
        const file = await prisma_1.prisma.receiptFile.findUnique({ where: { id } });
        if (!file)
            return server_1.NextResponse.json({ error: 'Not found' }, { status: 404 });
        // delete S3 object if key present
        try {
            if (file.key && process.env.S3_BUCKET)
                await (0, storage_1.deleteS3Object)(process.env.S3_BUCKET, file.key);
        }
        catch (e) {
            console.error('Failed to delete S3 object for receipt file', e);
        }
        await prisma_1.prisma.receiptFile.delete({ where: { id } });
        return server_1.NextResponse.json({ ok: true });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed';
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
