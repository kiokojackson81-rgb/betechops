import { NextRequest, NextResponse } from 'next/server';
import { jumiaFetch, loadShopAuthById, loadDefaultShopAuth } from '@/lib/jumia';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qs: Record<string, string> = {};
  const allow = ['status', 'size', 'country', 'shopId', 'dateFrom', 'dateTo', 'nextToken', 'q'];
  allow.forEach((k) => {
    const v = url.searchParams.get(k);
    if (v) qs[k] = v;
  });

  if (!qs.size) qs.size = '50';

  const query = new URLSearchParams(qs).toString();
  const path = query ? `orders?${query}` : 'orders';

  try {
    // Special scope: aggregate across all active JUMIA shops
    if ((qs.shopId || '').toUpperCase() === 'ALL') {
      // remove shopId from query for fan-out calls
      const q = new URLSearchParams(qs);
      q.delete('shopId');
      const basePath = `orders?${q.toString()}`;
      // fetch first page from each shop and combine
      const shops = await prisma.shop.findMany({ where: { isActive: true }, select: { id: true, platform: true } });
      const jumiaShops = shops.filter((s) => String(s.platform).toUpperCase() === 'JUMIA');
      const pages = await Promise.all(
        jumiaShops.map(async (s) => {
          try {
            const shopAuth = await loadShopAuthById(s.id).catch(() => undefined);
            const j = await jumiaFetch(basePath, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
            return j as any;
          } catch {
            return { orders: [] } as any;
          }
        })
      );
      const combined: any[] = [];
      for (const p of pages) {
        const arr = Array.isArray(p?.orders) ? p.orders : Array.isArray(p?.items) ? p.items : Array.isArray(p?.data) ? p.data : [];
        for (const it of arr) combined.push(it);
      }
      // Stable sort by createdAt desc (fallbacks) to match Jumia ordering semantics
      combined.sort((a: any, b: any) => {
        const getTs = (x: any) => {
          const v = x?.createdAt || x?.created_date || x?.created || x?.dateCreated;
          const t = v ? new Date(v).getTime() : 0;
          return isNaN(t) ? 0 : t;
        };
        return getTs(b) - getTs(a);
      });
      const pageSize = Math.max(1, Math.min(parseInt(qs.size || '50', 10) || 50, 100));
      const page = combined.slice(0, pageSize);
      // NOTE: For ALL shops aggregation, we currently return a single merged page (no composite cursor yet)
      return NextResponse.json({ orders: page, nextToken: null, isLastPage: true });
    }

    const shopAuth = qs.shopId ? await loadShopAuthById(qs.shopId).catch(() => undefined) : await loadDefaultShopAuth();
    const data = await jumiaFetch(path, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(JSON.stringify({ error: msg }), { status: 500 });
  }
}
