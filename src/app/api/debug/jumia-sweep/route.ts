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
    // core orders endpoints
    '/orders',
    `/orders?createdAfter=${today}&createdBefore=${today}`,
    '/orders?status=PENDING',
    '/orders?status=RETURNED',
    '/orders?status=pending-pricing',
    '/orders?limit=1',
    '/orders/items',
    '/orders/pack',
    '/v2/orders/pack',
    '/orders/print-labels',
    '/orders/ready-to-ship',
    '/orders/search?date=' + today,
    // api/version prefixes
    '/api/orders',
    '/api/v1/orders',
    '/api/v2/orders',
    '/v1/api/orders',
    '/seller/orders',
    '/seller-api/orders',

    // reports / payouts
    '/reports/sales?range=today',
    '/reports/sales?date=' + today,
    '/reports/payouts?day=' + today,
    `/payout-statement?createdAfter=${today}&page=1&size=10`,
    '/payout-statement',
    '/payouts',

    // returns
    '/returns',
    '/returns?status=waiting-pickup',
    '/returns?status=WAITING_PICKUP',

    // catalog / feeds
    '/catalog/brands?page=1',
    '/catalog/categories?page=1',
    '/catalog/products?size=10',
    '/feeds/products/stock',
    '/feeds/products/price',
    '/feeds/products/create',

    // misc
    '/shops',
    '/shops-of-master-shop',
    '/consignment-order',
    '/consignment-stock',
  ];

  // build bases: prefer resolved base then canonical + expanded list
  const resolved = await resolveJumiaConfig().catch(() => null);
  const bases: string[] = [];
  if (resolved?.base) bases.push(resolved.base.replace(/\/$/, ''));
  const baseCandidates = [
    'https://vendor-api.jumia.com',
    'https://vendor-api.jumia.com/api',
    'https://vendor-api.jumia.com/v1',
    'https://vendor-api.jumia.com/v2',
    'https://vendor-api.jumia.com/v3',
    'https://api.jumia.com',
    'https://api.jumia.com/v1',
    // some tenants use subdomains or vendor prefixes
    'https://api.vendor.jumia.com',
    'https://vendor.jumia.com',
  ];
  for (const b of baseCandidates) {
    const bb = b.replace(/\/$/, '');
    if (!bases.includes(bb)) bases.push(bb);
  }

  // get token (do not expose it)
  let token = '';
  try {
    token = await getJumiaAccessToken();
  } catch {
    try { token = await getAccessTokenFromEnv(); } catch { token = ''; }
  }

  // try multiple auth header schemes (do not return tokens)
  const authSchemes = resolved?.scheme ? [resolved.scheme, 'Bearer', 'Token', 'VcToken'] : ['Bearer', 'Token', 'VcToken'];

  const results: SweepResult[] = [];

  // For each path, try bases in order and for each base try multiple auth header schemes and also an unauthenticated attempt.
  for (const p of candidatePaths) {
    let found = false;
    for (const base of bases) {
      const fullUrl = `${base}${p.startsWith('/') ? p : '/' + p}`;
      // try unauthenticated first (ask for JSON)
      try {
        const r = await fetch(fullUrl, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
        const status = r.status;
        let preview = '';
        try { const txt = await r.text(); preview = txt ? (txt.length > 500 ? txt.slice(0, 500) + '...' : txt) : ''; } catch {}
        const ok = r.ok && status === 200;
        results.push({ path: p, base, status, ok, preview: preview ? preview : undefined });
        if (ok) { found = true; break; }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ path: p, base, status: 0, ok: false, error: msg });
      }

      // try each auth scheme (if we have a token)
      if (token) {
        for (const scheme of authSchemes) {
          try {
            const headers: Record<string, string> = { Authorization: `${scheme} ${token}`, Accept: 'application/json' };
            const r = await fetch(fullUrl, { method: 'GET', headers, cache: 'no-store' });
            const status = r.status;
            let preview = '';
            try { const txt = await r.text(); preview = txt ? (txt.length > 500 ? txt.slice(0, 500) + '...' : txt) : ''; } catch {}
            const ok = r.ok && status === 200;
            results.push({ path: p, base, status, ok, preview: preview ? preview : undefined });
            if (ok) { found = true; break; }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ path: p, base, status: 0, ok: false, error: msg });
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    // small delay to avoid hitting rate limits aggressively
    await new Promise((res) => setTimeout(res, 350));
  }

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() }, { status: 200 });
}
