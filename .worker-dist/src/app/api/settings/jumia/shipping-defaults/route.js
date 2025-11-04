"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const CONFIG_KEY = 'jumia:shipper-defaults';
async function loadDefaults() {
    const row = await prisma_1.prisma.config.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null);
    const json = (row?.json ?? {});
    if (json && typeof json === 'object')
        return json;
    return {};
}
async function saveDefaults(map) {
    await prisma_1.prisma.config.upsert({
        where: { key: CONFIG_KEY },
        update: { json: map },
        create: { key: CONFIG_KEY, json: map },
    });
}
async function GET() {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const map = await loadDefaults();
    return server_1.NextResponse.json({ defaults: map });
}
async function POST(req) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => ({})));
    const shopId = String(body.shopId || '').trim();
    const providerId = String(body.providerId || '').trim();
    if (!shopId || !providerId)
        return server_1.NextResponse.json({ error: 'shopId and providerId are required' }, { status: 400 });
    const map = await loadDefaults();
    map[shopId] = { providerId, label: body.label };
    await saveDefaults(map);
    return server_1.NextResponse.json({ ok: true, defaults: map });
}
async function DELETE(req) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const shopId = url.searchParams.get('shopId') || '';
    if (!shopId)
        return server_1.NextResponse.json({ error: 'shopId required' }, { status: 400 });
    const map = await loadDefaults();
    if (map[shopId]) {
        delete map[shopId];
        await saveDefaults(map);
    }
    return server_1.NextResponse.json({ ok: true, defaults: map });
}
