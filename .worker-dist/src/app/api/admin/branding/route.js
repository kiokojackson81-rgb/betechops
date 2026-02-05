"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const blob_1 = require("@vercel/blob");
const prisma_1 = require("@/lib/prisma");
exports.runtime = 'nodejs';
async function POST(req) {
    const form = await req.formData();
    const file = form.get('letterhead');
    const logo = form.get('logo');
    const brandColor = form.get('brandColor') || undefined;
    if (!file && !logo && !brandColor) {
        return server_1.NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
    }
    let letterheadUrl;
    let logoUrl;
    if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await (0, blob_1.put)(`branding/letterhead-${Date.now()}.jpg`, Buffer.from(arrayBuffer), {
            access: 'public',
            contentType: file.type || 'image/jpeg',
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        letterheadUrl = res.url;
    }
    if (logo) {
        const arrayBuffer = await logo.arrayBuffer();
        const res = await (0, blob_1.put)(`branding/logo-${Date.now()}.png`, Buffer.from(arrayBuffer), {
            access: 'public',
            contentType: logo.type || 'image/png',
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        logoUrl = res.url;
    }
    // Use the typed Prisma client now that generated types are available.
    const updated = await prisma_1.prisma.branding.upsert({
        where: { name: 'default' },
        update: {
            ...(letterheadUrl ? { letterheadUrl } : {}),
            ...(logoUrl ? { logoUrl } : {}),
            ...(brandColor ? { brandColor } : {}),
        },
        create: {
            name: 'default',
            letterheadUrl: letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
            logoUrl: logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
            brandColor: brandColor || '#7A2020',
        },
    });
    return server_1.NextResponse.json({ ok: true, branding: updated });
}
