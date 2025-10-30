import { prisma } from '@/lib/prisma';
import { getCatalogProductsCountQuickForShop, getCatalogProductsCountExactForShop, getPendingOrdersCountQuickForShop } from '@/lib/jumia';
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
  const perShop = await Promise.all(
    shops.map(async (s) => ({
      prod: await getCatalogProductsCountExactForShop({ shopId: s.id, size: 200, maxPages: 2000, timeMs: 5 * 60_000 }).catch(() => ({ total: 0, approx: true })),
      // keep pending orders as quick, they are usually small; adjust later if needed
      pend: await getPendingOrdersCountQuickForShop({ shopId: s.id, limitPages: 10, size: 100, timeMs: 20_000 }).catch(() => ({ total: 0, approx: true })),
    }))
  );
  const productsAll = perShop.reduce((n, s) => n + (s.prod?.total || 0), 0);
  const pendingAll = perShop.reduce((n, s) => n + (s.pend?.total || 0), 0);
  const approx = perShop.some((s) => s.prod?.approx || s.pend?.approx);
  const payload: CrossShopKpis = { productsAll, pendingAll, approx, updatedAt: Date.now() };
  await writeKpisCache(payload);
  return payload;
}
