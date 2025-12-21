import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jumiaFetch, loadShopAuthById, loadDefaultShopAuth } from '@/lib/jumia';
import { isSyncedStatus, normalizeStatus } from '@/lib/jumia/orderStatus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Head = { ts: number; id: string };

function parseHead(order: any): Head | null {
  if (!order || typeof order !== 'object') return null;
  const id = String(order.id ?? order.number ?? order.orderNumber ?? '');
  const v = order.createdAt ?? order.created_date ?? order.created ?? order.dateCreated;
  const ts = v ? new Date(v).getTime() : 0;
  if (!id || !ts || isNaN(ts)) return null;
  return { ts, id };
}

async function fetchNewestForShopVendor(
  shopId: string,
  params: { status?: string; country?: string; dateFrom?: string; dateTo?: string },
) {
  // Build minimal query asking for one newest item for this shop
  const qs: string[] = ['size=1'];
  if (params.status) qs.push(`status=${encodeURIComponent(params.status)}`);
  if (params.country) qs.push(`country=${encodeURIComponent(params.country)}`);
  if (params.dateFrom) qs.push(`createdAfter=${encodeURIComponent(params.dateFrom)}`);
  if (params.dateTo) qs.push(`createdBefore=${encodeURIComponent(params.dateTo)}`);
  const q = qs.length ? `?${qs.join('&')}` : '';

  const shopAuth = await loadShopAuthById(shopId).catch(() => undefined);
  const buildPath = () => {
    const base = `/orders${q}`;
    const url = new URL(base, 'http://local/');
    url.searchParams.delete('shopId');
    const search = url.search ? url.search : '';
    return {
      raw: `/orders${q}${q ? '&' : '?'}shopId=${encodeURIComponent(shopId)}`,
      sanitized: `${url.pathname}${search}`,
    };
  };

  const { raw: rawPath, sanitized } = buildPath();

  try {
    const j: any = await jumiaFetch(shopAuth ? sanitized : rawPath, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
    const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
    if (!arr.length) return null;
    return parseHead(arr[0]);
  } catch (e: any) {
    // Compatibility fallback: some tenants reject redundant shopId in query; retry without shopId but keep token
    const msg = e?.message ? String(e.message) : '';
    const code = typeof e?.status === 'number' ? e.status : 0;
    if (code === 400 || code === 422 || /\b(400|422)\b/.test(msg)) {
      const path2 = `/orders${q}`;
      const fallbackPath = shopAuth ? sanitized : path2;
      const j2: any = await jumiaFetch(fallbackPath, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
      const arr2 = Array.isArray(j2?.orders) ? j2.orders : Array.isArray(j2?.items) ? j2.items : Array.isArray(j2?.data) ? j2.data : [];
      if (!arr2.length) return null;
      return parseHead(arr2[0]);
    }
    // Otherwise bubble up by returning null (treat as no data for this tick)
    return null;
  }
}

async function fetchNewestForShopFromDb(
  shopId: string,
  params: { status?: string; country?: string; dateFrom?: string; dateTo?: string },
): Promise<Head | null> {
  const where: any = { shopId };
  const status = normalizeStatus(params.status);
  if (status && status !== 'ALL') where.status = status;
  if (params.country) where.countryCode = params.country.trim().toUpperCase();

  const dateFrom = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00Z`) : null;
  const dateTo = params.dateTo ? new Date(`${params.dateTo}T23:59:59Z`) : null;
  if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
    const range: { gte?: Date; lte?: Date } = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) range.gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) range.lte = dateTo;
    where.OR = [
      { updatedAtJumia: range },
      { AND: [{ updatedAtJumia: null }, { createdAtJumia: range }] },
      { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: range }] },
    ];
  }

  try {
    const record = await prisma.jumiaOrder.findFirst({
      where,
      orderBy: [
        { updatedAtJumia: 'desc' },
        { createdAtJumia: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        updatedAtJumia: true,
        createdAtJumia: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!record) return null;
    const comparable =
      record.updatedAtJumia ?? record.createdAtJumia ?? record.updatedAt ?? record.createdAt ?? null;
    if (!comparable) return null;
    const ts = comparable.getTime();
    return Number.isNaN(ts) ? null : { ts, id: record.id };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get('status');
  const normalizedStatus = normalizeStatus(statusRaw) ?? 'PENDING';
  let useSyncedStorage = isSyncedStatus(normalizedStatus);
  const countryParam = searchParams.get('country') || undefined;
  const country = countryParam ? countryParam.trim().toUpperCase() : undefined;
  const shopIdParam = searchParams.get('shopId') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const intervalMs = Math.max(2000, Math.min(10000, parseInt(searchParams.get('intervalMs') || '4000', 10) || 4000));

  // Resolve target shops
  let shopIds: string[] = [];
  if (shopIdParam && shopIdParam.toUpperCase() !== 'ALL') {
    shopIds = [shopIdParam];
  } else if (useSyncedStorage) {
    try {
      const rows = await prisma.jumiaShop.findMany({ select: { id: true } });
      shopIds = rows.map((r) => r.id);
    } catch {
      shopIds = [];
    }
    if (!shopIds.length) {
      // If no synced shops exist yet, fall back to vendor polling.
      useSyncedStorage = false;
    }
  }
  if (!shopIds.length) {
    try {
      const rows = await prisma.shop.findMany({ where: { isActive: true, platform: 'JUMIA' }, select: { id: true } });
      shopIds = rows.map((r) => r.id);
    } catch {
      shopIds = [];
    }
    if (!shopIds.length) {
      // last resort: try default shop auth and skip per-shop
      const def = await loadDefaultShopAuth().catch(() => undefined);
      if (!def) shopIds = [];
    }
  }

  // Per-shop last seen head
  const last: Record<string, Head | null> = Object.create(null);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(evt: string, data?: any) {
        const lines: string[] = [];
        lines.push(`event: ${evt}`);
        if (data !== undefined) lines.push(`data: ${JSON.stringify(data)}`);
        lines.push('\n');
        controller.enqueue(enc.encode(lines.join('\n')));
      }

      // Initial hello
      send('hello', { ok: true, status: normalizedStatus, country, shopIds, ts: Date.now(), source: useSyncedStorage ? 'db' : 'vendor' });

      let alive = true;
      const ac = new AbortController();
      req.signal.addEventListener('abort', () => { alive = false; ac.abort(); });

      // Heartbeat every 15s
      const ping = setInterval(() => {
        if (!alive) return;
        controller.enqueue(enc.encode(': ping\n\n'));
      }, 15000);

      const tick = async () => {
        if (!alive) return;
        try {
          let anyNew = false;
          for (const sid of shopIds) {
            const head = useSyncedStorage
              ? await fetchNewestForShopFromDb(sid, {
                  status: normalizedStatus,
                  country,
                  dateFrom,
                  dateTo,
                })
              : await fetchNewestForShopVendor(sid, {
                  status: normalizedStatus,
                  country,
                  dateFrom,
                  dateTo,
                });
            const prev = last[sid] || null;
            if (!prev && head) {
              last[sid] = head;
              // Don't fire immediately on first snapshot to avoid noisy initial event
              continue;
            }
            if (head && prev) {
              if (head.ts > prev.ts || (head.ts === prev.ts && head.id !== prev.id)) {
                last[sid] = head;
                anyNew = true;
              }
            }
          }
          if (anyNew) {
            send('orders', { type: 'orders:new', ts: Date.now(), shopIds });
          }
        } catch (e) {
          // Log but keep the stream alive
          try { console.error('orders/events tick error', e); } catch {}
        }
      };

      // Kick off periodic tick
      const interval = setInterval(tick, intervalMs);
      // Also run an initial priming tick (won't emit due to prev=null)
      void tick();

      // Close/cleanup on abort
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(ping);
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener('abort', cleanup, { once: true });
    },
    cancel() {
      // no-op; handled via abort listener
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Allow the browser to connect from any admin origin (adjust if needed)
      'Access-Control-Allow-Origin': '*',
    },
  });
}
