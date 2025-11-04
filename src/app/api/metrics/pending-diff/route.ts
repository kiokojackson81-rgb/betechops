import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addDays } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { absUrl } from '@/lib/abs-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = Number.parseInt(url.searchParams.get('days') || '7', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;
    const tz = 'Africa/Nairobi';
    const now = new Date();
    const since = zonedTimeToUtc(addDays(now, -days), tz);

    // DB counts
    const baseOr = [
      { updatedAtJumia: { gte: since } },
      { createdAtJumia: { gte: since } },
      { AND: [ { updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: since } } ] },
    ];
    const [dbPending, dbPendingMultiple] = await Promise.all([
      prisma.jumiaOrder.count({ where: { status: 'PENDING' as any, OR: baseOr } }),
      prisma.jumiaOrder.count({ where: { status: { in: ['PENDING', 'MULTIPLE'] as any }, OR: baseOr } }),
    ]);

    // Vendor live count (timeboxed)
    let vendorPending = null as null | number;
    let livePages = 0;
    let lastStatus: number | null = null;
    let lastError: string | null = null;
    let lastTriedUrl: string | null = null;
    try {
      const LIVE_TIMEOUT_MS = Number(process.env.KPIS_LIVE_TIMEOUT_MS ?? 3000);
      const LIVE_MAX_PAGES = Math.max(1, Number(process.env.KPIS_LIVE_MAX_PAGES ?? 5));
      const dateFrom = since.toISOString().slice(0, 10);
      const dateTo = now.toISOString().slice(0, 10);
      const start = Date.now();
      let token: string | null = null;
      let total = 0;
      do {
        const elapsed = Date.now() - start;
        if (elapsed >= LIVE_TIMEOUT_MS) break;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.max(1, LIVE_TIMEOUT_MS - elapsed));
        try {
          const base = `/api/orders?status=PENDING&shopId=ALL&size=100&fresh=1&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
          const fetchUrl = await absUrl(base);
          lastTriedUrl = base;
          const res = await fetch(fetchUrl, { cache: 'no-store', signal: controller.signal });
          lastStatus = res.status;
          if (!res.ok) {
            try { lastError = await res.text(); } catch {}
            break;
          }
          const j: any = await res.json();
          const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
          total += arr.length;
          token = (j?.nextToken ? String(j.nextToken) : '') || null;
          livePages += 1;
        } catch {
          lastError = e?.message ? String(e.message) : 'fetch-error';
          break;
        } finally {
          clearTimeout(timeout);
        }
      } while (token && livePages < LIVE_MAX_PAGES);
      vendorPending = total;
    } catch {
      vendorPending = null;
    }

    const payload = {
      ok: true,
      days,
      since,
      db: { pending: dbPending, pendingPlusMultiple: dbPendingMultiple },
  vendor: { pending: vendorPending, pages: livePages, lastStatus, lastError, lastTriedUrl },
      diff: vendorPending == null ? null : {
        vendorMinusDbPending: vendorPending - dbPending,
        vendorMinusDbPendingPlusMultiple: vendorPending - dbPendingMultiple,
      },
    };
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
