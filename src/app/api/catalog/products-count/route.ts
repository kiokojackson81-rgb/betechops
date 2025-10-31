import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  getShops,
  getCatalogProductsCountQuickForShop,
  getCatalogProductsCountExactForShop,
  getCatalogProductsCountExactAll,
} from "@/lib/jumia";

// GET /api/catalog/products-count
// Params:
// - shopId=<string> | all=true (when omitted and all not true, requires shopId)
// - exact=true|false (default false)
// - ttlMs: optional cache TTL override in milliseconds (default 30 minutes)
// - size, timeMs: optional fine-tuning passed to underlying counters
// Response:
// { total, approx, byStatus, byQcStatus, updatedAt }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = (url.searchParams.get("shopId") || "").trim();
  const all = (url.searchParams.get("all") || "").toLowerCase() === "true";
  const exactFlag = (url.searchParams.get("exact") || "").toLowerCase();
  const exact = exactFlag === "1" || exactFlag === "true" || exactFlag === "yes";
  const ttlMsRaw = Number(url.searchParams.get("ttlMs") || "");
  const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? Math.min(6 * 60 * 60_000, ttlMsRaw) : 30 * 60_000; // default 30 min, cap 6h
  const size = Math.min(500, Math.max(1, Number(url.searchParams.get("size") || (exact ? 200 : 100))));
  const timeMs = Math.min(120_000, Math.max(5_000, Number(url.searchParams.get("timeMs") || (exact ? 60_000 : 12_000))));
  const forceFlag = (url.searchParams.get("force") || "").toLowerCase();
  const force = forceFlag === "1" || forceFlag === "true" || forceFlag === "yes";

  try {
    const key = `catalog:counts:${all ? "ALL" : shopId || "UNKNOWN"}:${exact ? "exact" : "quick"}`;
    try {
      const r = await getRedis();
      if (!force && r && ttlMs > 0) {
        const hit = await r.get(key);
        if (hit) {
          // Validate cached payload. If totals > 0 but breakdowns are empty on a quick cache,
          // recompute using exact strategy to populate breakdowns and refresh cache.
          try {
            const cached = JSON.parse(hit) as { total?: number; approx?: boolean; byStatus?: Record<string, number>; byQcStatus?: Record<string, number> };
            const hasTotal = typeof cached?.total === 'number' && cached.total > 0;
            const breakdownEmpty = !cached?.byStatus || Object.keys(cached.byStatus).length === 0;
            const qcEmpty = !cached?.byQcStatus || Object.keys(cached.byQcStatus).length === 0;
            if (!exact && hasTotal && breakdownEmpty && qcEmpty) {
              // Bypass cache and compute an exact result to hydrate breakdowns
              let fresh: any = null;
              if (all) fresh = await getCatalogProductsCountExactAll({ size: Math.max(size, 200), timeMs: Math.max(timeMs, 45_000) }).catch(() => null);
              else if (shopId) fresh = await getCatalogProductsCountExactForShop({ shopId, size: Math.max(size, 200), timeMs: Math.max(timeMs, 45_000) }).catch(() => null);
              if (fresh) {
                const payload = { ...fresh, updatedAt: new Date().toISOString() };
                try { await r.set(key, JSON.stringify(payload), 'EX', Math.max(1, Math.floor(ttlMs / 1000))); } catch {}
                return NextResponse.json(payload, { headers: { 'x-cache': 'repaired' } });
              }
            }
            return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } });
          } catch {
            // fall through to recompute
          }
        }
      }
    } catch {
      // ignore redis errors
    }

    let result: { total: number; approx: boolean; byStatus: Record<string, number>; byQcStatus: Record<string, number> } = {
      total: 0,
      approx: true,
      byStatus: {},
      byQcStatus: {},
    };

  if (all) {
      if (exact) {
        const totals = await getCatalogProductsCountExactAll({ size, timeMs }).catch(() => null);
        if (totals) result = totals as typeof result;
      } else {
        // quick path: sum quick counts per shop; if no shops or zero totals, fallback to exact-all
        const shops = await getShops().catch(() => [] as any[]);
        const shopList = Array.isArray(shops) ? shops : [];
        const counts = await Promise.allSettled(
          shopList.map((s: any) =>
            getCatalogProductsCountQuickForShop({ shopId: String(s.id || s.shopId || ""), limitPages: 4, size: Math.max(size, 50), timeMs }),
          ),
        );
  const byStatus: Record<string, number> = {};
  const byQcStatus: Record<string, number> = {};
  let total = 0;
  let approx = shopList.length === 0;
        for (const c of counts) {
          if (c.status === "fulfilled") {
            const v = c.value as any;
            total += Number(v?.total || 0);
            approx = approx || Boolean(v?.approx);
            for (const [k, n] of Object.entries((v?.byStatus as Record<string, number>) || {})) byStatus[String(k).toLowerCase()] = (byStatus[String(k).toLowerCase()] || 0) + Number(n || 0);
            for (const [k, n] of Object.entries((v?.byQcStatus as Record<string, number>) || {})) byQcStatus[String(k).toLowerCase()] = (byQcStatus[String(k).toLowerCase()] || 0) + Number(n || 0);
          } else {
            approx = true;
          }
        }
        // If we couldn't find shops or totals are zero, try an exact-all fallback once
        if (shopList.length === 0 || total === 0) {
          const fallback = await getCatalogProductsCountExactAll({ size: Math.max(size, 200), timeMs: Math.max(timeMs, 45_000) }).catch(() => null);
          if (fallback) {
            result = fallback as typeof result;
          } else {
            result = { total, approx: true, byStatus, byQcStatus };
          }
        } else {
          // If total > 0 but breakdowns are empty (some vendor payloads omit status/QC in quick scans),
          // compute an exact-all fallback to populate breakdowns.
          const breakdownEmpty = Object.keys(byStatus).length === 0 && Object.keys(byQcStatus).length === 0;
          if (breakdownEmpty && total > 0) {
            const fallback = await getCatalogProductsCountExactAll({ size: Math.max(size, 200), timeMs: Math.max(timeMs, 45_000) }).catch(() => null);
            if (fallback) {
              result = fallback as typeof result;
            } else {
              result = { total, approx, byStatus, byQcStatus };
            }
          } else {
            result = { total, approx, byStatus, byQcStatus };
          }
        }
      }
    } else {
      if (!shopId) return NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
      if (exact) {
        const totals = await getCatalogProductsCountExactForShop({ shopId, size, timeMs }).catch(() => null);
        if (totals) result = totals as typeof result;
      } else {
        const totals = await getCatalogProductsCountQuickForShop({ shopId, limitPages: 6, size: Math.max(size, 100), timeMs }).catch(() => null);
        if (totals) {
          // If quick totals found but breakdowns are empty while total > 0, fallback to exact for this shop to compute breakdowns.
          const byStatus = (totals as any).byStatus || {};
          const byQcStatus = (totals as any).byQcStatus || {};
          const breakdownEmpty = Object.keys(byStatus).length === 0 && Object.keys(byQcStatus).length === 0;
          if (breakdownEmpty && (totals as any).total > 0) {
            const exactTotals = await getCatalogProductsCountExactForShop({ shopId, size: Math.max(size, 200), timeMs: Math.max(timeMs, 45_000) }).catch(() => null);
            if (exactTotals) {
              result = exactTotals as typeof result;
            } else {
              result = totals as typeof result;
            }
          } else {
            result = totals as typeof result;
          }
        }
      }
    }

    const payload = { ...result, updatedAt: new Date().toISOString() };

    try {
      const r = await getRedis();
      if (r && ttlMs > 0) await r.set(key, JSON.stringify(payload), "EX", Math.max(1, Math.floor(ttlMs / 1000)));
    } catch {
      // ignore redis errors
    }

    return NextResponse.json(payload, { headers: { "x-cache": "miss" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
