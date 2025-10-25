import { NextResponse } from 'next/server';
import { getJumiaAccessToken, getAccessTokenFromEnv } from '@/lib/oidc';
import { resolveJumiaConfig } from '@/lib/jumia';

type SweepResult = {
  path: string;
  base?: string;
  status: number;
  ok: boolean;
  preview?: string;
  error?: string;
};

/**
 * GET /api/debug/jumia-sweep?run=true
 * Runs a targeted authenticated sweep: for each candidate path, try bases in order
 * and return the first base that returns 200. Does not return tokens.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('run') !== 'true') {
    return NextResponse.json({ ok: false, message: 'Call with ?run=true to execute sweep' });
  }

  // candidate paths derived from Vendor API doc
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

  // build bases: prefer resolved base then canonical list
  const resolved = await resolveJumiaConfig().catch(() => null);
  const bases: string[] = [];
  if (resolved?.base) bases.push(resolved.base.replace(/\/$/, ''));
  for (const b of ['https://vendor-api.jumia.com', 'https://vendor-api.jumia.com/api', 'https://vendor-api.jumia.com/v1', 'https://vendor-api.jumia.com/v2']) {
    const bb = b.replace(/\/$/, '');
    if (!bases.includes(bb)) bases.push(bb);
  }

  // get token (do not expose it)
  let token = '';
  try {
    token = await getJumiaAccessToken();
  } catch (e) {
    try { token = await getAccessTokenFromEnv(); } catch { token = ''; }
  }

  const scheme = resolved?.scheme || 'Bearer';

  const results: SweepResult[] = [];

  // For each path, try bases in order and stop at first 200
  for (const p of candidatePaths) {
    let found = false;
    for (const base of bases) {
      const url = `${base}${p.startsWith('/') ? p : '/' + p}`;
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `${scheme} ${token}`;
        const r = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
        const status = r.status;
        let preview = '';
        try {
          const txt = await r.text();
          preview = txt ? (txt.length > 500 ? txt.slice(0, 500) + '...' : txt) : '';
        } catch {}
        const ok = r.ok && status === 200;
        results.push({ path: p, base, status, ok, preview: preview ? preview : undefined });
        if (ok) { found = true; break; }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ path: p, status: 0, ok: false, error: msg });
      }
    }
    // small delay to avoid hitting rate limits aggressively
    await new Promise((res) => setTimeout(res, 250));
  }

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() }, { status: 200 });
}
