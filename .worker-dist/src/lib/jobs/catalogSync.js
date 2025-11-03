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
    var _a, _b, _c;
    const shops = await (0, jumia_1.getShops)();
    const nowIso = new Date().toISOString();
    for (const s of (Array.isArray(shops) ? shops : [])) {
        const shopId = String((s === null || s === void 0 ? void 0 : s.id) || (s === null || s === void 0 ? void 0 : s.shopId) || "");
        if (!shopId)
            continue;
        try {
            const res = await (0, jumia_1.getCatalogProducts)({ size: 200, shopId });
            const total = Number((_c = (_b = (_a = res === null || res === void 0 ? void 0 : res.total) !== null && _a !== void 0 ? _a : res === null || res === void 0 ? void 0 : res.totalCount) !== null && _b !== void 0 ? _b : res === null || res === void 0 ? void 0 : res.totalElements) !== null && _c !== void 0 ? _c : (Array.isArray(res === null || res === void 0 ? void 0 : res.products) ? res.products.length : 0));
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
                update: { json: { shopId, total: 0, lastSynced: nowIso, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) } },
                create: { key: `catalog:shop:${shopId}:latest`, json: { shopId, total: 0, lastSynced: nowIso, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) } },
            });
        }
    }
}
exports.default = { syncAllCatalogs };
