import { prisma } from '@/lib/prisma';
import { getCatalogProductsCountQuickForShop, getCatalogProductsCountExactForShop, getCatalogProductsCountExactAll, getPendingOrdersCountQuickForShop } from '@/lib/jumia';
import { writeKpisCache, type CrossShopKpis } from '@/lib/kpisCache';
import { absUrl } from '@/lib/abs-url';

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
  // Pending orders: prefer a true cross-shop aggregation through our internal ALL-shops Orders API
  // This avoids requiring per-shop credentials and reflects the live vendor state.
  let pendingAll = 0;
  let pendingApprox = false;
  try {
    // Walk through all pages of /api/orders?status=PENDING&shopId=ALL
    let token: string | null = null;
    do {
      const base = `/api/orders?status=PENDING&shopId=ALL&size=100${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
      const url = await absUrl(base);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`orders ALL failed: ${res.status}`);
      const j: any = await res.json();
      const arr = Array.isArray(j?.orders)
        ? j.orders
        : Array.isArray(j?.items)
        ? j.items
        : Array.isArray(j?.data)
        ? j.data
        : [];
      pendingAll += arr.length;
      token = (j?.nextToken ? String(j.nextToken) : '') || null;
      // small safety to avoid infinite loops on malformed tokens
      if (token && typeof token !== 'string') token = null;
    } while (token);
  } catch {
    // Fallback: bounded per-shop sum (may be approximate if shops lack credentials)
    pendingApprox = true;
    const perShopPending = await Promise.all(
      shops.map(async (s) => await getPendingOrdersCountQuickForShop({ shopId: s.id, limitPages: 10, size: 100, timeMs: 20_000 }).catch(() => ({ total: 0, approx: true })))
    );
    pendingAll = perShopPending.reduce((n, s) => n + (s?.total || 0), 0);
    pendingApprox = perShopPending.some((s) => s?.approx) || false;
  }

  const productsAll = prodAll.total;
  const approx = Boolean(prodAll.approx) || pendingApprox;
  const payload: CrossShopKpis = { productsAll, pendingAll, approx, updatedAt: Date.now() };
  await writeKpisCache(payload);
  return payload;
}
