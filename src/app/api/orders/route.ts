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
    // Special scope: aggregate across all active JUMIA shops with composite pagination
    if ((qs.shopId || '').toUpperCase() === 'ALL') {
      // Helper accessors
      const getTs = (x: any) => {
        const v = x?.createdAt || x?.created_date || x?.created || x?.dateCreated;
        const t = v ? new Date(v).getTime() : 0;
        return isNaN(t) ? 0 : t;
      };
      const getId = (x: any) => String(x?.id ?? x?.number ?? x?.orderNumber ?? '');
      const cmpDesc = (a: any, b: any) => {
        const ta = getTs(a), tb = getTs(b);
        if (tb !== ta) return tb - ta; // newer first
        const ia = getId(a), ib = getId(b);
        return ib.localeCompare(ia); // desc by id for tie-breaker
      };

      const pageSize = Math.max(1, Math.min(parseInt(qs.size || '50', 10) || 50, 100));

      // Decode cursor token, if any
      type Cursor = { ts: number; id?: string };
      let cursor: Cursor | null = null;
      const rawTok = qs.nextToken || qs.token || '';
      if (rawTok) {
        try {
          const dec = JSON.parse(Buffer.from(String(rawTok), 'base64').toString('utf8')) as { v?: number; mode?: string; cur?: Cursor };
          if (dec && dec.cur && typeof dec.cur.ts === 'number') cursor = dec.cur;
        } catch {}
      }

      // Build base path without shopId for per-shop calls; carry through filters
      const qBase = new URLSearchParams(qs);
      qBase.delete('shopId');
      qBase.delete('nextToken');
      qBase.delete('token');
      const basePath = `orders?${qBase.toString()}`;

      // Active JUMIA shops
      const shops = await prisma.shop.findMany({ where: { isActive: true }, select: { id: true, platform: true } });
      const jumiaShops = shops.filter((s) => String(s.platform).toUpperCase() === 'JUMIA');

      // Per-shop state
      type ShopState = { id: string; buf: any[]; token: string | null; isLast: boolean };
      const states: ShopState[] = await Promise.all(
        jumiaShops.map(async (s) => {
          const st: ShopState = { id: s.id, buf: [], token: null, isLast: false };
          try {
            // Prime first page
            const shopAuth = await loadShopAuthById(s.id).catch(() => undefined);
            const j = await jumiaFetch(basePath, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
            const arr = Array.isArray((j as any)?.orders)
              ? (j as any).orders
              : Array.isArray((j as any)?.items)
              ? (j as any).items
              : Array.isArray((j as any)?.data)
              ? (j as any).data
              : [];
            const annotated = arr.map((o: any) => (o && typeof o === 'object' ? { ...o, shopIds: (o?.shopIds?.length ? o.shopIds : [s.id]) } : o));
            st.token = String((j as any)?.nextToken ?? (j as any)?.token ?? '') || null;
            st.isLast = !st.token;
            // If cursor present, drop anything >= cursor (newer-or-equal)
            st.buf = cursor
              ? annotated.filter((it: any) => {
                  const ts = getTs(it);
                  if (ts < cursor!.ts) return true;
                  if (ts > cursor!.ts) return false;
                  // equal ts → compare id strictly less than cursor id (older)
                  const id = getId(it);
                  return (cursor!.id ? id.localeCompare(cursor!.id) < 0 : false);
                })
              : annotated;
            // If we have a cursor and the buffer is still empty, try to advance pages until we cross the cursor or exhaust
            let safety = 0;
            while (cursor && st.buf.length === 0 && !st.isLast && safety < 5) {
              const p = new URL(basePath, 'http://x/');
              const qp = p.search ? `${p.pathname}${p.search}&token=${encodeURIComponent(String(st.token))}` : `${p.pathname}?token=${encodeURIComponent(String(st.token))}`;
              const j2 = await jumiaFetch(qp.slice(1), shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
              const arr2 = Array.isArray((j2 as any)?.orders)
                ? (j2 as any).orders
                : Array.isArray((j2 as any)?.items)
                ? (j2 as any).items
                : Array.isArray((j2 as any)?.data)
                ? (j2 as any).data
                : [];
              const annotated2 = arr2.map((o: any) => (o && typeof o === 'object' ? { ...o, shopIds: (o?.shopIds?.length ? o.shopIds : [s.id]) } : o));
              st.token = String((j2 as any)?.nextToken ?? (j2 as any)?.token ?? '') || null;
              st.isLast = !st.token;
              const filtered = annotated2.filter((it: any) => {
                const ts = getTs(it);
                if (ts < cursor!.ts) return true;
                if (ts > cursor!.ts) return false;
                const id = getId(it);
                return (cursor!.id ? id.localeCompare(cursor!.id) < 0 : false);
              });
              st.buf.push(...filtered);
              safety += 1;
            }
          } catch {
            st.buf = [];
            st.token = null;
            st.isLast = true;
          }
          return st;
        })
      );

      const out: any[] = [];
      // k-way merge by repeatedly taking the newest head across shop buffers
      while (out.length < pageSize) {
        // Refill any empty buffers (no cursor case) by paging once if possible
        const empties = states.filter((s) => s.buf.length === 0 && !s.isLast && !cursor);
        if (empties.length) {
          await Promise.all(
            empties.map(async (st) => {
              try {
                const shopAuth = await loadShopAuthById(st.id).catch(() => undefined);
                const p = new URL(basePath, 'http://x/');
                const qp = st.token
                  ? p.search
                    ? `${p.pathname}${p.search}&token=${encodeURIComponent(String(st.token))}`
                    : `${p.pathname}?token=${encodeURIComponent(String(st.token))}`
                  : `${p.pathname}${p.search}`;
                const j = await jumiaFetch(qp.slice(1), shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
                const arr = Array.isArray((j as any)?.orders)
                  ? (j as any).orders
                  : Array.isArray((j as any)?.items)
                  ? (j as any).items
                  : Array.isArray((j as any)?.data)
                  ? (j as any).data
                  : [];
                const annotated = arr.map((o: any) => (o && typeof o === 'object' ? { ...o, shopIds: (o?.shopIds?.length ? o.shopIds : [st.id]) } : o));
                st.token = String((j as any)?.nextToken ?? (j as any)?.token ?? '') || null;
                st.isLast = !st.token;
                st.buf.push(...annotated);
              } catch {
                st.isLast = true;
              }
            })
          );
        }

        // pick best head
        let bestIdx = -1;
        for (let i = 0; i < states.length; i++) {
          const st = states[i];
          if (!st.buf.length) continue;
          if (bestIdx === -1) { bestIdx = i; continue; }
          // Pick the item that should come first (newest) per comparator
          if (cmpDesc(st.buf[0], states[bestIdx].buf[0]) < 0) {
            bestIdx = i;
          }
        }
        if (bestIdx === -1) break; // nothing to take
        const picked = states[bestIdx].buf.shift();
        out.push(picked);
      }

      // Build next token based on the last item we emitted
      let nextToken: string | null = null;
      if (out.length === pageSize) {
        const last = out[out.length - 1];
        const cur = { ts: getTs(last), id: getId(last) } as Cursor;
        nextToken = Buffer.from(JSON.stringify({ v: 1, mode: 'ALL', cur }), 'utf8').toString('base64');
      }

      const isLastPage = out.length < pageSize; // conservative: if we couldn't fill, treat as last
      return NextResponse.json({ orders: out, nextToken, isLastPage });
    }

    const shopAuth = qs.shopId ? await loadShopAuthById(qs.shopId).catch(() => undefined) : await loadDefaultShopAuth();
    try {
      const data = await jumiaFetch(path, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
      return NextResponse.json(data);
    } catch (e: any) {
      // Some tenants error if shopId is supplied while the token is already scoped; retry without shopId.
      const msg = e?.message ? String(e.message) : '';
      const code = typeof e?.status === 'number' ? e.status : 0;
      if (qs.shopId && (code === 400 || code === 422 || /\b(400|422)\b/.test(msg))) {
        const q2 = new URLSearchParams(qs);
        q2.delete('shopId');
        const p2 = `orders?${q2.toString()}`;
        const data2 = await jumiaFetch(p2, shopAuth ? ({ method: 'GET', shopAuth } as any) : ({ method: 'GET' } as any));
        return NextResponse.json(data2);
      }
      throw e;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(JSON.stringify({ error: msg }), { status: 500 });
  }
}
