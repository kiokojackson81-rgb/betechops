"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAllCatalogs = syncAllCatalogs;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
/**
 * Iterate all shops and snapshot catalog totals.
 * Writes to Config as key `catalog:shop:${shopId}:latest` to avoid schema changes.
 */
async function syncAllCatalogs() {
    const shops = await (0, jumia_1.getShops)();
    const nowIso = new Date().toISOString();
    for (const s of (Array.isArray(shops) ? shops : [])) {
        const shopId = String(s?.id || s?.shopId || "");
        if (!shopId)
            continue;
        try {
            const res = await (0, jumia_1.getCatalogProducts)({ size: 200, shopId });
            const total = Number(res?.total ?? res?.totalCount ?? res?.totalElements ?? (Array.isArray(res?.products) ? res.products.length : 0));
            const key = `catalog:shop:${shopId}:latest`;
            const json = { shopId, total, lastSynced: nowIso };
            await prisma_1.prisma.config.upsert({
                where: { key },
                update: { json },
                create: { key, json },
            });
        }
        catch (e) {
            // best-effort; continue
            await prisma_1.prisma.config.upsert({
                where: { key: `catalog:shop:${shopId}:latest` },
                update: { json: { shopId, total: 0, lastSynced: nowIso, error: e?.message || String(e) } },
                create: { key: `catalog:shop:${shopId}:latest`, json: { shopId, total: 0, lastSynced: nowIso, error: e?.message || String(e) } },
            });
        }
    }
}
exports.default = { syncAllCatalogs };
