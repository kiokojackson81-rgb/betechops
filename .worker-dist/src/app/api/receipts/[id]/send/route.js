"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const receiptSender_1 = require("@/workers/receiptSender");
const auth_1 = require("@/lib/auth");
exports.dynamic = 'force-dynamic';
async function POST(req, context) {
    const session = await (0, auth_1.auth)();
    if (!session)
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const channels = Array.isArray(body?.channels) ? body.channels : [];
    try {
        const { id } = 'params' in context && typeof context.params?.then === 'function'
            ? await context.params
            : context.params;
        const res = await (0, receiptSender_1.sendReceiptChannels)(id, channels);
        return server_1.NextResponse.json({ ok: true, res });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed';
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
