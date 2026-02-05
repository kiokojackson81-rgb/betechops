"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const prisma_1 = require("@/lib/prisma");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
async function resolveParams(context) {
    const params = context.params;
    if (params && typeof params.then === 'function') {
        return params;
    }
    return Promise.resolve(context.params);
}
async function GET(_req, context) {
    const { id: receiptId } = await resolveParams(context);
    if (!receiptId) {
        return new Response(JSON.stringify({ error: 'Missing receipt id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    try {
        const file = await prisma_1.prisma.receiptFile.findFirst({
            where: { receiptId, contentType: 'application/pdf', url: { not: '' } },
            orderBy: { uploadedAt: 'desc' },
        });
        if (!file?.url) {
            return new Response(JSON.stringify({ error: 'PDF not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const upstream = await fetch(file.url, { redirect: 'follow' });
        if (!upstream.ok || !upstream.body) {
            return new Response(JSON.stringify({ error: 'Failed to fetch upstream PDF' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Cache-Control', 'no-store');
        headers.set('Content-Disposition', `inline; filename="receipt-${receiptId}.pdf"`);
        const len = upstream.headers.get('content-length');
        if (len)
            headers.set('Content-Length', len);
        return new Response(upstream.body, { status: 200, headers });
    }
    catch (error) {
        console.error('[api/receipts/[id]/receipt.pdf] error', error);
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
