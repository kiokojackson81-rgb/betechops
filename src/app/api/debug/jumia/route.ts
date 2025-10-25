import { NextResponse } from "next/server";
import { getSalesToday, getPendingPricingCount, getReturnsWaitingPickup, resolveJumiaConfig } from "@/lib/jumia";
import { getJumiaAccessToken, getAccessTokenFromEnv } from '@/lib/oidc';

type Probe<T> = { ok: true; ms: number; data: T } | { ok: false; ms: number; error: string };

async function probe<T>(fn: () => Promise<T>): Promise<Probe<T>> {
  const t0 = Date.now();
  try {
    const data = await fn();
    return { ok: true, ms: Date.now() - t0, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, ms: Date.now() - t0, error: msg };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const doDeepProbe = url.searchParams.get('probe') === 'true' || url.searchParams.get('deep') === 'true';

  const [salesToday, pendingPricing, returnsWaitingPickup, resolved] = await Promise.all([
    probe(() => getSalesToday()),
    probe(() => getPendingPricingCount()),
    probe(() => getReturnsWaitingPickup()),
    resolveJumiaConfig().then((r) => ({ base: r.base, scheme: r.scheme })).catch(() => null),
  ]);

  const ok = (salesToday && salesToday.ok) || (pendingPricing && pendingPricing.ok) || (returnsWaitingPickup && returnsWaitingPickup.ok);

  const responseBody: any = {
    ok,
    resolved,
    salesToday,
    pendingPricing,
    returnsWaitingPickup,
    timestamp: new Date().toISOString(),
  };

  if (doDeepProbe) {
    // candidate paths based on Vendor API doc
    const today = new Date().toISOString().slice(0, 10);
    const candidatePaths = [
      '/orders',
      `/orders?createdAfter=${today}&createdBefore=${today}`,
      '/orders?status=PENDING',
      '/orders?status=RETURNED',
      '/orders/items',
      '/orders/shipment-providers',
      '/orders/pack',
      '/v2/orders/pack',
      '/orders/print-labels',
      '/orders/ready-to-ship',
      `/payout-statement?createdAfter=${today}&page=1&size=10`,
      '/shops',
      '/shops-of-master-shop',
      '/catalog/brands?page=1',
      '/catalog/categories?page=1',
      '/catalog/products?size=10',
      '/feeds/products/stock',
      '/feeds/products/price',
      '/feeds/products/create',
      '/consignment-order',
      '/consignment-stock',
      '/returns',
      '/returns?status=waiting-pickup',
    ];

    // build base candidates with resolved base preferred
    const bases = [] as string[];
    if (resolved?.base) bases.push(resolved.base.replace(/\/$/, ''));
    for (const b of ['https://vendor-api.jumia.com', 'https://vendor-api.jumia.com/api', 'https://vendor-api.jumia.com/v1', 'https://vendor-api.jumia.com/v2']) {
      const bb = b.replace(/\/$/, '');
      if (!bases.includes(bb)) bases.push(bb);
    }

    // get token for auth (do not return token value)
    let token = '';
    try {
      token = await getJumiaAccessToken();
    } catch (e) {
      try { token = await getAccessTokenFromEnv(); } catch { token = ''; }
    }

    const scheme = resolved?.scheme || 'Bearer';

    const probeResults: Array<any> = [];
    for (const base of bases) {
      for (const p of candidatePaths) {
        const url = `${base}${p.startsWith('/') ? p : '/' + p}`;
        try {
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `${scheme} ${token}`;
          const r = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
          let preview = '';
          try {
            const txt = await r.text();
            preview = txt ? (txt.length > 300 ? txt.slice(0, 300) + '...' : txt) : '';
          } catch { preview = '' }
          probeResults.push({ base, path: p, status: r.status, ok: r.ok, preview });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          probeResults.push({ base, path: p, status: 0, ok: false, error: msg });
        }
      }
    }

    responseBody.probeNote = 'deep candidate probe executed; token/mint not returned';
    responseBody.probeResults = probeResults;
  }

  return NextResponse.json(responseBody);
}

// When ?probe=true is supplied, run an authenticated sweep of candidate endpoints and return lightweight results.
export async function GET_probe() {
  // kept for backward compatibility but not used directly by Next routing — we implement deep probe inside GET with query
  return NextResponse.json({ ok: false, message: 'Use ?probe=true on GET to run deep probe' });
}
