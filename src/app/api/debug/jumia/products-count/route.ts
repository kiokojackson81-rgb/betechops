import { NextResponse } from "next/server";
import { getShopsOfMasterShop, jumiaFetch, loadDefaultShopAuth } from "@/lib/jumia";

// GET /api/debug/jumia/products-count?shopName=JM%20Latest%20Collections
//    or /api/debug/jumia/products-count?shopId=<prismaId>
//    or /api/debug/jumia/products-count?sids=<sid1[,sid2]>
// Returns: { ok, by: 'sid'|'shopId'|'shopName'|'all', shop?: { name, sid }, total, approx }
// Notes:
// - Prefers fast-path by requesting size=1 and reading a metadata total from response
// - Falls back to paginating within a bounded time window if metadata not present

type C = { total: number; approx: boolean; byStatus?: Record<string, number> };

function extractTotal(obj: unknown): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const keys = new Set(['total', 'totalCount', 'count', 'total_items', 'totalItems', 'recordsTotal', 'totalElements']);
  const q: unknown[] = [obj];
  const seen = new Set<unknown>();
  while (q.length) {
    const cur: any = q.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (typeof v === 'number' && keys.has(k)) return v;
      if (v && typeof v === 'object') q.push(v);
    }
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopName = url.searchParams.get('shopName') || url.searchParams.get('name') || '';
  const shopId = url.searchParams.get('shopId') || '';
  const sidsQ = url.searchParams.get('sids') || '';
  const all = url.searchParams.get('all') === 'true';
  const timeMs = Math.min(120_000, Math.max(5_000, Number(url.searchParams.get('timeMs') || 45_000)));
  const size = Math.min(500, Math.max(1, Number(url.searchParams.get('size') || 200)));

  try {
    // Resolve SID(s)
    let sids: string[] | undefined = undefined;
    let matchedName: string | undefined = undefined;
    if (sidsQ) {
      sids = sidsQ.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (shopName) {
      const shops = await getShopsOfMasterShop().catch(() => [] as any[]);
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const target = norm(shopName);
      let best: any = null;
      let bestScore = -1;
      for (const sh of (Array.isArray(shops) ? shops : [])) {
        const nm = String(sh?.name || sh?.shopName || sh?.label || '').trim();
        const sid = String(sh?.sid || sh?.id || sh?.shopId || '') || '';
        if (!nm || !sid) continue;
        const score = nm.toLowerCase().includes(target) ? 2 : (target.includes(nm.toLowerCase()) ? 1 : 0);
        if (score > bestScore) { bestScore = score; best = { sid, name: nm }; }
      }
      if (best) { sids = [best.sid]; matchedName = best.name; }
    }

    // If shopId was provided, try to use per-shop credentials by hitting the shop-specific param to vendor
    // However, vendor supports sids filter; prefer that when we have SID.
    const shopAuth = await loadDefaultShopAuth().catch(() => undefined);

    // Fast-path: ask for one item and read the total from response metadata
    const params = new URLSearchParams();
    params.set('size', '1');
    if (sids && sids.length) params.set('sids', sids.join(','));
    if (shopId && !params.has('sids')) params.set('shopId', shopId);

    const first = await jumiaFetch(`/catalog/products?${params.toString()}`, shopAuth ? ({ shopAuth } as any) : ({} as any)).catch(() => null);
    const hinted = extractTotal(first);
    if (typeof hinted === 'number' && hinted >= 0) {
      return NextResponse.json({ ok: true, by: sids?.length ? 'sid' : (shopId ? 'shopId' : (shopName ? 'shopName' : 'default')), shop: matchedName ? { name: matchedName, sid: sids?.[0] } : undefined, total: hinted, approx: false, source: 'metadata' });
    }

    // Fallback: paginate with a time cap
    const byStatus: Record<string, number> = {};
    let total = 0;
    const t0 = Date.now();
    let token = '';
    // pull pages via the vendor pagination mechanics using token/nextToken heuristic
    while (true) {
      const qp = new URLSearchParams();
      qp.set('size', String(size));
      if (sids && sids.length) qp.set('sids', sids.join(','));
      if (shopId && !qp.has('sids')) qp.set('shopId', shopId);
      if (token) qp.set('token', token);
      const page = await jumiaFetch(`/catalog/products?${qp.toString()}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
      const arr = Array.isArray((page as any)?.products) ? (page as any).products : Array.isArray((page as any)?.items) ? (page as any).items : Array.isArray((page as any)?.data) ? (page as any).data : [];
      for (const it of arr) {
        total += 1;
        const st = String((it as any)?.status || (it as any)?.itemStatus || 'unknown').toLowerCase();
        byStatus[st] = (byStatus[st] || 0) + 1;
      }
      token = String((page as any)?.nextToken || (page as any)?.token || (page as any)?.next || '');
      if (!token || Date.now() - t0 > timeMs) break;
    }
    const approx = Date.now() - t0 > timeMs;
    return NextResponse.json({ ok: true, by: sids?.length ? 'sid' : (shopId ? 'shopId' : (shopName ? 'shopName' : 'default')), shop: matchedName ? { name: matchedName, sid: sids?.[0] } : undefined, total, approx, byStatus, source: 'scan' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
