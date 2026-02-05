"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranding = getBranding;
const prisma_1 = require("@/lib/prisma");
async function getBranding() {
    // Use the typed Prisma client now that generated types are available.
    const branding = await prisma_1.prisma.branding.findUnique({ where: { name: 'default' } });
    return {
        letterheadUrl: branding?.letterheadUrl ||
            process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL ||
            '/letterhead.jpg',
        logoUrl: branding?.logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
        brandColor: branding?.brandColor || '#7A2020',
        siteTitle: process.env.RECEIPT_SITE_TITLE || 'Betech Solar Solutions',
    };
}
