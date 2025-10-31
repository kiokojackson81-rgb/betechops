import { prisma } from '@/lib/prisma';
import { getCatalogProductsCountQuickForShop, getCatalogProductsCountExactForShop, getCatalogProductsCountExactAll, getPendingOrdersCountQuickForShop } from '@/lib/jumia';
import { writeKpisCache, type CrossShopKpis } from '@/lib/kpisCache';

export async function updateKpisCache(): Promise<CrossShopKpis> {
  const shops = await prisma.shop.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true } });
  const perShop = await Promise.all(
    shops.map(async (s) => ({
      prod: await getCatalogProductsCountQuickForShop({ shopId: s.id, limitPages: 6, size: 100, timeMs: 15_000 }).catch(() => ({ total: 0, approx: true })),
      pend: await getPendingOrdersCountQuickForShop({ shopId: s.id, limitPages: 6, size: 50, timeMs: 10_000 }).catch(() => ({ total: 0, approx: true })),
    }))
  );
  const productsAll = perShop.reduce((n, s) => n + (s.prod?.total || 0), 0);
  const pendingAll = perShop.reduce((n, s) => n + (s.pend?.total || 0), 0);
  const approx = perShop.some((s) => s.prod?.approx || s.pend?.approx);
  const payload: CrossShopKpis = { productsAll, pendingAll, approx, updatedAt: Date.now() };
  await writeKpisCache(payload);
  return payload;
}

export async function updateKpisCacheExact(): Promise<CrossShopKpis> {
  const shops = await prisma.shop.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true } });
  // Use master-account all-shops exact counter for products to avoid 14x fan-out
  const prodAll = await getCatalogProductsCountExactAll({ size: 100, timeMs: 55_000 }).catch(() => ({ total: 0, approx: true }));
  // Pending orders can remain a bounded sum per shop (usually small)
  const perShopPending = await Promise.all(
    shops.map(async (s) => await getPendingOrdersCountQuickForShop({ shopId: s.id, limitPages: 10, size: 100, timeMs: 20_000 }).catch(() => ({ total: 0, approx: true })))
  );
  const productsAll = prodAll.total;
  const pendingAll = perShopPending.reduce((n, s) => n + (s?.total || 0), 0);
  const approx = Boolean(prodAll.approx) || perShopPending.some((s) => s?.approx);
  const payload: CrossShopKpis = { productsAll, pendingAll, approx, updatedAt: Date.now() };
  await writeKpisCache(payload);
  return payload;
}
