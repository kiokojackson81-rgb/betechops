"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("@/lib/prisma");
const kpis_1 = require("@/lib/jobs/kpis");
const jumia_1 = require("@/lib/jumia");
async function main() {
    console.log("Diagnostics: Shops and KPIs\n==============================");
    const shops = await prisma_1.prisma.shop.findMany({ where: { isActive: true }, select: { id: true, name: true, platform: true, credentialsEncrypted: true } });
    console.table(shops.map(s => ({ id: s.id, name: s.name, platform: s.platform, hasCreds: !!s.credentialsEncrypted })));
    // Quick vendor sanity: attempt quick product count for first JUMIA shop
    const jumiaShop = shops.find(s => String(s.platform).toUpperCase() === 'JUMIA');
    if (jumiaShop) {
        try {
            const quick = await (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId: jumiaShop.id, limitPages: 2, size: 50, timeMs: 5000 });
            console.log(`\nQuick catalog count for '${jumiaShop.name}':`, quick);
        }
        catch (e) {
            console.warn(`\nQuick catalog count failed for '${jumiaShop.name}':`, (e === null || e === void 0 ? void 0 : e.message) || e);
        }
    }
    // All-shops exact products (via master)
    try {
        const allExact = await (0, jumia_1.getCatalogProductsCountExactAll)({ size: 200, timeMs: 30000 });
        console.log("\nAll-shops exact product total:", allExact);
    }
    catch (e) {
        console.warn("\nAll-shops exact product total failed:", (e === null || e === void 0 ? void 0 : e.message) || e);
    }
    // KPIs cache quick and exact
    try {
        const quickKpis = await (0, kpis_1.updateKpisCache)();
        console.log("\nKPIs (quick):", quickKpis);
    }
    catch (e) {
        console.warn("\nKPIs (quick) failed:", (e === null || e === void 0 ? void 0 : e.message) || e);
    }
    try {
        const exactKpis = await (0, kpis_1.updateKpisCacheExact)();
        console.log("KPIs (exact):", exactKpis);
    }
    catch (e) {
        console.warn("KPIs (exact) failed:", (e === null || e === void 0 ? void 0 : e.message) || e);
    }
}
main()
    .then(() => prisma_1.prisma.$disconnect())
    .catch((e) => {
    console.error(e);
    return prisma_1.prisma.$disconnect().then(() => process.exit(1));
});
