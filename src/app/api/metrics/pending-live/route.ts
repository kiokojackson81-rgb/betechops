import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jumiaFetch, jumiaPaginator, loadShopAuthById } from '@/lib/jumia';
import { addDays } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

type PerShop = { shopId: string; count: number; pages: number; approx?: boolean; error?: string | null };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const windowDays = Math.max(1, Number(url.searchParams.get('days') ?? 7));
  const timeoutMs = Math.max(500, Number(url.searchParams.get('timeoutMs') ?? 2500));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('size') ?? 100)));

  const started = Date.now();
  const deadline = started + timeoutMs;
  const DEFAULT_TZ = 'Africa/Nairobi';
  const now = new Date();
  const windowStart = zonedTimeToUtc(addDays(now, -windowDays), DEFAULT_TZ);
  const windowEnd = zonedTimeToUtc(now, DEFAULT_TZ);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

  // Discover shops known locally
  const shops = await prisma.jumiaShop.findMany({ select: { id: true } });
  const perShop: PerShop[] = [];

  for (const s of shops) {
    if (Date.now() >= deadline) break;
    const shopId = s.id;
    const shopAuth = await loadShopAuthById(shopId).catch(() => undefined);
    const baseParams: Record<string, string> = {
      status: 'PENDING',
      size: String(pageSize),
      shopId,
      updatedAfter: fmt(windowStart),
      updatedBefore: fmt(windowEnd),
      sort: 'DESC',
    };

    let pages = 0;
    let count = 0;
    let approx = false;
    let error: string | null = null;
    const fetcher = (path: string) => jumiaFetch(
      path,
      shopAuth ? ({ shopAuth, shopCode: shopId } as any) : ({ shopCode: shopId } as any),
    );

    try {
      for await (const page of jumiaPaginator('/orders', baseParams, fetcher)) {
        if (Date.now() >= deadline) {
          approx = true;
          break;
        }
        const arr = Array.isArray((page as any)?.orders)
          ? (page as any).orders
          : Array.isArray((page as any)?.items)
          ? (page as any).items
          : Array.isArray((page as any)?.data)
          ? (page as any).data
          : [];
        count += arr.length;
        pages += 1;
        if (pages >= 2000) {
          approx = true;
          break;
        }
        if (Date.now() >= deadline) {
          approx = true;
          break;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    perShop.push({ shopId, count, pages, approx: approx || undefined, error: error || undefined });
    if (Date.now() >= deadline) break;
  }

  const total = perShop.reduce((acc, r) => acc + r.count, 0);
  const approxGlobal = perShop.length < shops.length || perShop.some((r) => r.approx || r.error);
  const res = NextResponse.json({
    ok: true,
    total,
    approx: approxGlobal,
    perShop,
    shops: shops.length,
    processedShops: perShop.length,
    tookMs: Date.now() - started,
    windowDays,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
