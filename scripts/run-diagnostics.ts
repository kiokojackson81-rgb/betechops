import { prisma } from "@/lib/prisma";
import { updateKpisCache, updateKpisCacheExact } from "@/lib/jobs/kpis";
import { getCatalogProductsCountExactAll, getCatalogProductsCountQuickForShop } from "@/lib/jumia";

async function main() {
  console.log("Diagnostics: Shops and KPIs\n==============================");
  const shops = await prisma.shop.findMany({ where: { isActive: true }, select: { id: true, name: true, platform: true, credentialsEncrypted: true } });
  console.table(shops.map(s => ({ id: s.id, name: s.name, platform: s.platform, hasCreds: !!s.credentialsEncrypted })));

  // Quick vendor sanity: attempt quick product count for first JUMIA shop
  const jumiaShop = shops.find(s => String(s.platform).toUpperCase() === 'JUMIA');
  if (jumiaShop) {
    try {
      const quick = await getCatalogProductsCountQuickForShop({ shopId: jumiaShop.id, limitPages: 2, size: 50, timeMs: 5000 });
      console.log(`\nQuick catalog count for '${jumiaShop.name}':`, quick);
    } catch (e) {
      console.warn(`\nQuick catalog count failed for '${jumiaShop.name}':`, (e as Error)?.message || e);
    }
  }

  // All-shops exact products (via master)
  try {
    const allExact = await getCatalogProductsCountExactAll({ size: 200, timeMs: 30000 });
    console.log("\nAll-shops exact product total:", allExact);
  } catch (e) {
    console.warn("\nAll-shops exact product total failed:", (e as Error)?.message || e);
  }

  // KPIs cache quick and exact
  try {
    const quickKpis = await updateKpisCache();
    console.log("\nKPIs (quick):", quickKpis);
  } catch (e) {
    console.warn("\nKPIs (quick) failed:", (e as Error)?.message || e);
  }
  try {
    const exactKpis = await updateKpisCacheExact();
    console.log("KPIs (exact):", exactKpis);
  } catch (e) {
    console.warn("KPIs (exact) failed:", (e as Error)?.message || e);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
