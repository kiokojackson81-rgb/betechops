"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const receiptSender_1 = require("@/workers/receiptSender");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const crypto_1 = require("crypto");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
function formatHost(req) {
    // Prefer forwarded host header when present (Vercel / proxies)
    return (req.headers.get('x-forwarded-host') || req.headers.get('host') || req.headers.get('x-vercel-forwarded-host') || 'unknown');
}
async function POST(req, context) {
    const requestId = (0, crypto_1.randomUUID)();
    const startedAt = Date.now();
    // Resolve receipt id from context
    let receiptId = '';
    try {
        const paramsObj = 'params' in context && typeof context.params?.then === 'function'
            ? await context.params
            : context.params;
        receiptId = String(paramsObj.id || '');
    }
    catch (e) {
        console.error(`[receiptSend][rid=${requestId}] failed to resolve params`, e);
        return server_1.NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    // Parse incoming channels from body OR querystring (support PrintControls link)
    let channels = [];
    try {
        const body = await req.json().catch(() => ({}));
        if (Array.isArray(body?.channels))
            channels = body.channels;
    }
    catch {
        // ignore parse error
    }
    // fallback to query param ?channels=whatsapp or ?channels=email
    try {
        if (!channels.length) {
            const url = new URL(req.url);
            const q = url.searchParams.get('channels');
            if (q)
                channels = q.split(',').map((s) => s.trim()).filter(Boolean);
        }
    }
    catch {
        // ignore
    }
    // Determine host/origin and attempt auth (log user if present)
    const host = formatHost(req);
    let session = null;
    try {
        session = await (0, auth_1.auth)();
    }
    catch (maybeRes) {
        // auth() may throw a NextResponse redirect; convert to JSON 401
        console.error(`[receiptSend][rid=${requestId}] auth redirect or error`, maybeRes);
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session) {
        console.warn(`[receiptSend][rid=${requestId}] unauthenticated request`);
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.info(`[receiptSend][rid=${requestId}] HIT /api/receipts/${receiptId}/send host=${host} channels=${JSON.stringify(channels)} user=${session?.user?.id ?? session?.user?.email ?? 'unknown'}`);
    try {
        // Log: load receipt from DB
        console.info(`[receiptSend][rid=${requestId}] DB:loading ${receiptId}`);
        const receipt = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId } });
        if (!receipt) {
            console.error(`[receiptSend][rid=${requestId}] DB:missing receipt ${receiptId}`);
            return server_1.NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }
        console.info(`[receiptSend][rid=${requestId}] DB:loaded ok`);
        // Call worker to perform send pipeline (PDF generation, upload, chatrace, email, whatsapp)
        console.info(`[receiptSend][rid=${requestId}] ACTION:sendReceiptChannels start`);
        const result = await (0, receiptSender_1.sendReceiptChannels)(receiptId, channels, { requestId });
        console.info(`[receiptSend][rid=${requestId}] ACTION:sendReceiptChannels end`, { result });
        // After worker returned, inspect receipt metadata for pdf/chatrace info
        try {
            const fresh = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId } });
            const chatrace = fresh?.data && typeof fresh.data === 'object' ? fresh.data.chatrace : undefined;
            const pdfUrl = chatrace?.pdfUrl ?? (fresh?.data && typeof fresh.data === 'object' ? fresh.data.pdfUrl : undefined);
            const pdfLen = typeof pdfUrl === 'string' ? pdfUrl.length : 0;
            console.info(`[receiptSend][rid=${requestId}] PDF:url ${pdfLen}`);
            console.info(`[receiptSend][rid=${requestId}] CHATRACE:ok success=${Boolean(result?.channelStatus?.chatrace === 'sent')}`);
        }
        catch (inspectErr) {
            console.warn(`[receiptSend][rid=${requestId}] post-inspect failed`, inspectErr);
        }
        const durationMs = Date.now() - startedAt;
        console.info(`[receiptSend][rid=${requestId}] END durationMs=${durationMs}`);
        return server_1.NextResponse.json({ ok: true, result, durationMs });
    }
    catch (err) {
        console.error(`[receiptSend][rid=${requestId}] ERROR`, err);
        const msg = err instanceof Error ? err.message : 'Failed';
        const durationMs = Date.now() - startedAt;
        console.info(`[receiptSend][rid=${requestId}] END durationMs=${durationMs}`);
        return server_1.NextResponse.json({ error: msg, durationMs }, { status: 500 });
    }
}
