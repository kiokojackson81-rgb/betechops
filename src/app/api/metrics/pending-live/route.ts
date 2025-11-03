import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jumiaFetch, jumiaPaginator, loadShopAuthById } from '@/lib/jumia';

export const dynamic = 'force-dynamic';

type PerShop = { shopId: string; count: number; pages: number };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const windowDays = Math.max(1, Number(url.searchParams.get('days') ?? 7));
  const timeoutMs = Math.max(500, Number(url.searchParams.get('timeoutMs') ?? 2500));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('size') ?? 100)));

  const started = Date.now();
  const deadline = started + timeoutMs;

  // Discover shops known locally
  const shops = await prisma.jumiaShop.findMany({ select: { id: true } });
  const perShop: PerShop[] = [];

  for (const s of shops) {
    if (Date.now() >= deadline) break;
    const shopId = s.id;
    const shopAuth = await loadShopAuthById(shopId).catch(() => undefined);
    const baseParams: Record<string, string> = { status: 'PENDING', size: String(pageSize) };

    let token: string | null = null;
    let pages = 0;
    let count = 0;
    const fetcher = (path: string) => jumiaFetch(path, shopAuth ? ({ shopAuth } as any) : ({} as any));

    try {
      do {
        if (Date.now() >= deadline) break;
        const params = new URLSearchParams(baseParams);
        if (token) params.set('token', token);
        const q = params.toString();
        const page: any = await fetcher(`/orders${q ? `?${q}` : ''}`);
        const arr = Array.isArray(page?.orders)
          ? page.orders
          : Array.isArray(page?.items)
          ? page.items
          : Array.isArray(page?.data)
          ? page.data
          : [];
        count += arr.length;
        token = (page?.nextToken ? String(page.nextToken) : '') || null;
        pages += 1;
        if (page?.isLastPage === true) break;
      } while (token && pages < 2000);
    } catch {
      // ignore errors per shop; continue
    }
    perShop.push({ shopId, count, pages });
  }

  const total = perShop.reduce((acc, r) => acc + r.count, 0);
  const res = NextResponse.json({ ok: true, total, perShop, shops: shops.length, tookMs: Date.now() - started });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
