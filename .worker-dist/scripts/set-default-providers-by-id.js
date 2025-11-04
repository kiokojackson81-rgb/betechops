"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const CONFIG_KEY = 'jumia:shipper-defaults';
// Exact mapping provided by user (no guesswork)
const entries = [
    // Lucytech BS-Station
    { shopId: 'cmhh86fdv0003v5ywzosd5wjd', providerId: 'KE-VDO-3PL-Lucytech BS-Station', label: 'Lucytech BS-Station' }, // Betech Solar Solution
    { shopId: 'cmhh86h740007v5ywifsv25br', providerId: 'KE-VDO-3PL-Lucytech BS-Station', label: 'Lucytech BS-Station' }, // JM Latest Collections
    { shopId: 'cmhh86gbt0005v5ywpk0fr5b7', providerId: 'KE-VDO-3PL-Lucytech BS-Station', label: 'Lucytech BS-Station' }, // Maxton Enterprise
    // Denfa Luthuli-Station
    { shopId: 'cmhh86dpy0000v5ywr6586os4', providerId: 'KE-VDO-3PL-Denfa Luthuli-Station', label: 'Denfa Luthuli-Station' }, // Betech Store
    { shopId: 'cmhh86efr0001v5ywisgim35n', providerId: 'KE-VDO-3PL-Denfa Luthuli-Station', label: 'Denfa Luthuli-Station' }, // Hitech Power
    { shopId: 'cmhh86fur0004v5ywthycrqo9', providerId: 'KE-VDO-3PL-Denfa Luthuli-Station', label: 'Denfa Luthuli-Station' }, // Sky Store Ke
    { shopId: 'cmhh86gsw0006v5yw2jpm23d7', providerId: 'KE-VDO-3PL-Denfa Luthuli-Station', label: 'Denfa Luthuli-Station' }, // LabTech Kenya
    { shopId: 'cmhh86ewt0002v5ywwa09kc76', providerId: 'KE-VDO-3PL-Denfa Luthuli-Station', label: 'Denfa Luthuli-Station' }, // JUDE COLLECTIONS
];
async function main() {
    // Load existing config
    const row = await prisma.config.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null);
    const map = (row?.json || {});
    for (const e of entries) {
        map[e.shopId] = { providerId: e.providerId, label: e.label };
    }
    await prisma.config.upsert({
        where: { key: CONFIG_KEY },
        update: { json: map },
        create: { key: CONFIG_KEY, json: map },
    });
    // Summary
    console.log('Default providers saved to config key:', CONFIG_KEY);
    for (const e of entries) {
        console.log(`- ${e.shopId}: ${e.providerId}${e.label ? ` (${e.label})` : ''}`);
    }
}
main().finally(async () => {
    try {
        await prisma.$disconnect();
    }
    catch { }
});
