import { prisma } from "@/lib/prisma";
import { getAccessTokenFromEnv, getJumiaAccessToken, getJumiaTokenInfo } from '@/lib/oidc';

type Cache = {
  accessToken?: string;
  exp?: number;
  cfg?: (Config & { loadedAt: number });
};
const cache: Cache = {};

type Config = {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  apiBase?: string;
  tokenUrl?: string; // optional explicit token endpoint override
  endpoints?: {
    salesToday?: string;            // e.g., '/orders?createdAfter=YYYY-MM-DD&createdBefore=YYYY-MM-DD'
    pendingPricing?: string;        // e.g., '/orders?status=PENDING'
    returnsWaitingPickup?: string;  // e.g., '/orders?status=RETURNED' or '/returns?status=waiting-pickup'
  };
};

async function loadConfig(): Promise<Config> {
  const now = Date.now();
  if (cache.cfg && now - cache.cfg.loadedAt < 5 * 60_000) return cache.cfg;

  // Prefer env if present
  // Support both legacy JUMIA_* env vars and the more generic OIDC_* names
  let cfg: Config = {
    issuer: process.env.JUMIA_OIDC_ISSUER || process.env.OIDC_ISSUER,
    clientId: process.env.JUMIA_CLIENT_ID || process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.JUMIA_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET,
    refreshToken: process.env.JUMIA_REFRESH_TOKEN || process.env.OIDC_REFRESH_TOKEN,
  // Prefer canonical `base_url` for vendor base; fall back to legacy JUMIA_API_BASE for compatibility
  apiBase: process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE,
  // tokenUrl may be provided explicitly; discovery/defaulting happens in oidc helper
  tokenUrl: process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL,
    endpoints: {
      salesToday: process.env.JUMIA_EP_SALES_TODAY,
      pendingPricing: process.env.JUMIA_EP_PENDING_PRICING,
      returnsWaitingPickup: process.env.JUMIA_EP_RETURNS_WAITING_PICKUP,
    },
  };

  const missing = !cfg.issuer || !cfg.clientId || !cfg.refreshToken || !cfg.apiBase;
  if (missing) {
    try {
      const row = await prisma.apiCredential.findFirst({ where: { scope: "GLOBAL" } });
      if (row) {
        cfg = {
          issuer: cfg.issuer || row.issuer || undefined,
          clientId: cfg.clientId || row.clientId || undefined,
          clientSecret: cfg.clientSecret || row.apiSecret || undefined,
          refreshToken: cfg.refreshToken || row.refreshToken || undefined,
          apiBase: cfg.apiBase || row.apiBase || undefined,
          endpoints: cfg.endpoints,
        };
      }
    } catch {
      // ignore DB errors in diagnostics; rely on env-only
    }
  }

  cache.cfg = { ...cfg, loadedAt: now };
  return cfg;
}

/**
 * Get an access token using your long-lived REFRESH TOKEN.
 * We cache it in-memory on the server until ~60s before expiry.
 */
async function getAccessToken(): Promise<string> {
  // Prefer the Jumia-specific refresh token minting when JUMIA_OIDC_TOKEN_URL is present
  try {
    // If either the legacy JUMIA_* vars or the standard OIDC_* vars are present, use the Jumia/OIDC mint flow
      if (
        process.env.OIDC_TOKEN_URL ||
        process.env.OIDC_REFRESH_TOKEN ||
        process.env.JUMIA_OIDC_TOKEN_URL ||
        process.env.JUMIA_REFRESH_TOKEN
      ) {
      return await getJumiaAccessToken();
    }
  } catch (e) {
    // fall back to generic env-based flow
    // eslint-disable-next-line no-console
    console.error('getJumiaAccessToken failed, falling back to generic:', e instanceof Error ? e.message : String(e));
  }
  return getAccessTokenFromEnv();
}

// Cached resolved detection
let resolvedConfig: { base?: string; scheme?: string; tried?: boolean } | null = null;

export async function resolveJumiaConfig(): Promise<{ base: string; scheme: string }> {
  if (resolvedConfig && resolvedConfig.base && resolvedConfig.scheme) return { base: resolvedConfig.base, scheme: resolvedConfig.scheme } as { base: string; scheme: string };

  // Respect explicit env first
  // Respect explicit canonical env first (base_url), then legacy JUMIA_API_BASE
  const envBase = process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE;
  const envScheme = process.env.JUMIA_AUTH_SCHEME;
  if (envBase && envScheme) {
    resolvedConfig = { base: envBase, scheme: envScheme, tried: true };
    return { base: envBase, scheme: envScheme };
  }

  // Candidate bases to probe. Keep /api and /v1 variants as probes but prefer bare vendor host.
  const bases = [
    'https://vendor-api.jumia.com',
    'https://vendor-api.jumia.com/api',
    'https://vendor-api.jumia.com/v1',
    'https://vendor-api.jumia.com/v2',
  ];
  const schemes = ['Bearer', 'Token', 'VcToken'];

  // token for probing
  let token = '';
  try { token = await getAccessToken(); } catch (_) { token = '' }

  for (const base of bases) {
    // if explicit base set, skip other bases
    for (const scheme of schemes) {
  // probe a lightweight orders endpoint (the doc indicates /orders is the canonical resource)
  const today = new Date().toISOString().slice(0, 10);
  const url = `${base.replace(/\/$/, '')}/orders?createdAfter=${today}&createdBefore=${today}`;
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `${scheme} ${token}`;
        const r = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
        const text = await r.text().catch(() => '');
        // success
        if (r.status === 200) {
          resolvedConfig = { base, scheme, tried: true };
          return { base, scheme };
        }
        // If 401 and returned body indicates scheme invalid, try next scheme
        if (r.status === 401 && /Authorization type is invalid/i.test(text)) {
          continue; // try next scheme
        }
        // If not 404 and not 403, accept this base/scheme (token might be expired/invalid)
        if (r.status !== 404 && r.status !== 403) {
          resolvedConfig = { base, scheme, tried: true };
          return { base, scheme };
        }
      } catch (e) {
        // network error -> try next candidate
        continue;
      }
    }
  }

  // final fallback: prefer canonical env/base host without automatically appending `/api`
  const fallbackBase = envBase || 'https://vendor-api.jumia.com';
  const fallbackScheme = envScheme || 'Bearer';
  resolvedConfig = { base: fallbackBase, scheme: fallbackScheme, tried: true };
  return { base: fallbackBase, scheme: fallbackScheme };
}

/**
 * Wrapper to call Jumia API with Authorization header.
 * Usage: await jumiaFetch("/some/endpoint?param=1")
 */
export async function jumiaFetch(path: string, init: RequestInit = {}) {
  const cfg = await loadConfig();
  const resolved = await resolveJumiaConfig();
  // Prefer canonical base_url env, then legacy JUMIA_API_BASE, then DB-config, then resolved probe
  const apiBase = process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE || cfg.apiBase || resolved.base;
  if (!apiBase) throw new Error("Missing vendor base URL (process.env.base_url or JUMIA_API_BASE); cannot call Jumia API");
  const scheme = process.env.JUMIA_AUTH_SCHEME || resolved.scheme || 'Bearer';
  const token = await getAccessToken();
  const url = `${apiBase.replace(/\/$/, '')}${path}`;
  const bodyPresent = Boolean((init as RequestInit).body);
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `${scheme} ${token}`,
    "Content-Type": bodyPresent ? "application/json" : undefined,
  } as Record<string, string>;

  const r = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    console.error("Jumia API error:", r.status, msg, "path:", path, "base:", apiBase, "scheme:", scheme);
    const err: any = new Error(`Jumia ${path} failed: ${r.status} ${msg}`);
    err.status = r.status;
    err.body = msg;
    throw err;
  }
  return r.json().catch(() => ({}));
}

/* ---- Example helpers (replace paths with your real ones) ---- */

// Sales today (normalize to { total })
export async function getSalesToday() {
  const { endpoints } = await loadConfig();
  // Prefer explicit endpoint override; otherwise use /orders and count items for today
  const today = new Date().toISOString().slice(0, 10);
  const explicit = endpoints?.salesToday;
  const path = explicit || `/orders?createdAfter=${today}&createdBefore=${today}`;
  const j = await jumiaFetch(path);
  // The Orders API returns { orders: [...] } per the doc
  const orders = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.data) ? j.data : [];
  return { total: orders.length };
}

// Orders pending pricing (normalize to { count })
export async function getPendingPricingCount() {
  const { endpoints } = await loadConfig();
  const explicit = endpoints?.pendingPricing;
  const path = explicit || '/orders?status=PENDING';
  const j = await jumiaFetch(path);
  const orders = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
  return { count: orders.length };
}

// Returns waiting pickup (normalize to { count })
export async function getReturnsWaitingPickup() {
  const { endpoints } = await loadConfig();
  const explicit = endpoints?.returnsWaitingPickup;
  // Prefer explicit; otherwise check orders with RETURNED status or a /returns endpoint
  const pathCandidates = explicit ? [explicit] : ['/orders?status=RETURNED', '/returns', '/returns?status=waiting-pickup'];
  for (const p of pathCandidates) {
    try {
      const j = await jumiaFetch(p);
      const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
      return { count: arr.length };
    } catch (e) {
      // try next candidate
      continue;
    }
  }
  return { count: 0 };
}

/**
 * Non-secret OIDC diagnostics. Does not return tokens or secrets.
 * If test=true, it will attempt a refresh_token exchange and report success and TTL.
 */
export async function diagnoseOidc(opts?: { test?: boolean }) {
  const cfg = await loadConfig();
  const issuer = cfg.issuer || process.env.JUMIA_OIDC_ISSUER || "";
  const res: {
    issuer: string;
    clientIdSet: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
    tokenEndpoint?: string[];
    test?: { ok: boolean; expiresIn?: number; error?: string };
  } = {
    issuer,
    clientIdSet: Boolean(cfg.clientId || process.env.JUMIA_CLIENT_ID || process.env.OIDC_CLIENT_ID),
    hasClientSecret: Boolean(cfg.clientSecret || process.env.JUMIA_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET),
    hasRefreshToken: Boolean(cfg.refreshToken || process.env.JUMIA_REFRESH_TOKEN || process.env.OIDC_REFRESH_TOKEN),
  };

  if (opts?.test) {
    try {
      // build the same candidate list we would use in getAccessToken
      const candidates: string[] = [];
      if (cfg.tokenUrl) candidates.push(cfg.tokenUrl);
      const issuer0 = cfg.issuer || process.env.JUMIA_OIDC_ISSUER || "";
      if (issuer0) {
        const primary = `${issuer0.replace(/\/?$/, "")}/protocol/openid-connect/token`;
          candidates.push(primary);
          // Some Jumia docs and older setups expose a simple /token endpoint (per vendor API spec)
          candidates.push(`${issuer0.replace(/\/?$/, "")}/token`);
        if (issuer0.includes("/auth/realms/")) {
          const altIssuer = issuer0.replace("/auth/realms/", "/realms/");
          candidates.push(`${altIssuer.replace(/\/?$/, "")}/protocol/openid-connect/token`);
        } else if (issuer0.includes("/realms/")) {
          const altIssuer = issuer0.replace("/realms/", "/auth/realms/");
          candidates.push(`${altIssuer.replace(/\/?$/, "")}/protocol/openid-connect/token`);
        }
      }
      res.tokenEndpoint = candidates;
      // attempt to mint via the Jumia refresh flow (if configured)
      try {
        const token = await getJumiaAccessToken();
        const info = getJumiaTokenInfo();
        const now = Date.now();
        const expiresIn = info.expiresAt ? Math.max(0, Math.floor((info.expiresAt - now) / 1000)) : undefined;
        res.test = { ok: true, expiresIn };
      } catch (e) {
        // fall back to generic access token flow; we can't introspect the generic cache here reliably,
        // so just attempt to mint and report success without TTL.
        await getAccessToken();
        res.test = { ok: true };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.test = { ok: false, error: msg };
    }
  }

  return res;
}

// --- New: marketplace-specific normalized fetchers ---
import { normalizeFromJumia, type NormalizedOrder } from './connectors/normalize';

export async function fetchOrdersForShop(shopId: string, opts?: { since?: string }): Promise<NormalizedOrder[]> {
  // Load shop credentials from DB or env
  const cfg = await loadConfig();
  // Use /orders and allow since to be mapped to createdAfter
  const pathBase = cfg.endpoints?.pendingPricing || '/orders';
  let q = '';
  if (opts?.since) {
    // map since to createdAfter (ISO date expected)
    q = `?createdAfter=${encodeURIComponent(opts.since)}`;
  }
  try {
    const j = await jumiaFetch(pathBase + q);
    const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : j?.data || [];
    return arr.map((r: unknown) => normalizeFromJumia(r, shopId));
  } catch (e) {
    throw e;
  }
}

export async function fetchPayoutsForShop(shopId: string, opts?: { day?: string }) {
  const cfg = await loadConfig();
  const pathBase = cfg.endpoints?.salesToday || '/payout-statement';
  const q = opts?.day ? `?createdAfter=${encodeURIComponent(opts.day)}&page=1&size=50` : '?page=1&size=50';
  const j = await jumiaFetch(pathBase + q);
  return j;
}

/* ---- New: explicit wrapper functions for common vendor endpoints ---- */

export async function getShops() {
  // GET /shops
  const j = await jumiaFetch('/shops');
  return j?.shops || j || [];
}

export async function getShopsOfMasterShop() {
  const j = await jumiaFetch('/shops-of-master-shop');
  return j?.shops || j || [];
}

export async function getCatalogBrands(page = 1) {
  const j = await jumiaFetch(`/catalog/brands?page=${encodeURIComponent(String(page))}`);
  return j;
}

export async function getCatalogCategories(page = 1, attributeSetName?: string) {
  const q = attributeSetName ? `?page=${encodeURIComponent(String(page))}&attributeSetName=${encodeURIComponent(attributeSetName)}` : `?page=${encodeURIComponent(String(page))}`;
  const j = await jumiaFetch(`/catalog/categories${q}`);
  return j;
}

export async function getCatalogProducts(opts?: { token?: string; size?: number; sids?: string[]; categoryCode?: number; sellerSku?: string; shopId?: string }) {
  const params: string[] = [];
  if (opts?.token) params.push(`token=${encodeURIComponent(opts.token)}`);
  if (opts?.size) params.push(`size=${encodeURIComponent(String(opts.size))}`);
  if (opts?.sids && opts.sids.length) params.push(`sids=${opts.sids.map(encodeURIComponent).join(',')}`);
  if (opts?.categoryCode) params.push(`categoryCode=${encodeURIComponent(String(opts.categoryCode))}`);
  if (opts?.sellerSku) params.push(`sellerSku=${encodeURIComponent(opts.sellerSku)}`);
  if (opts?.shopId) params.push(`shopId=${encodeURIComponent(opts.shopId)}`);
  const q = params.length ? `?${params.join('&')}` : '';
  const j = await jumiaFetch(`/catalog/products${q}`);
  return j;
}

export async function postFeedProductsStock(payload: unknown) {
  return await jumiaFetch('/feeds/products/stock', { method: 'POST', body: JSON.stringify(payload) });
}

export async function postFeedProductsPrice(payload: unknown) {
  return await jumiaFetch('/feeds/products/price', { method: 'POST', body: JSON.stringify(payload) });
}

export async function postFeedProductsStatus(payload: unknown) {
  return await jumiaFetch('/feeds/products/status', { method: 'POST', body: JSON.stringify(payload) });
}

export async function postFeedProductsCreate(payload: unknown) {
  return await jumiaFetch('/feeds/products/create', { method: 'POST', body: JSON.stringify(payload) });
}

export async function postFeedProductsUpdate(payload: unknown) {
  return await jumiaFetch('/feeds/products/update', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getFeedById(id: string) {
  if (!id) throw new Error('feed id required');
  return await jumiaFetch(`/feeds/${encodeURIComponent(id)}`);
}

export async function getOrders(opts?: { status?: string; createdAfter?: string; createdBefore?: string; token?: string; size?: number; country?: string; shopId?: string }) {
  const params: string[] = [];
  if (opts?.status) params.push(`status=${encodeURIComponent(opts.status)}`);
  if (opts?.createdAfter) params.push(`createdAfter=${encodeURIComponent(opts.createdAfter)}`);
  if (opts?.createdBefore) params.push(`createdBefore=${encodeURIComponent(opts.createdBefore)}`);
  if (opts?.token) params.push(`token=${encodeURIComponent(opts.token)}`);
  if (opts?.size) params.push(`size=${encodeURIComponent(String(opts.size))}`);
  if (opts?.country) params.push(`country=${encodeURIComponent(opts.country)}`);
  if (opts?.shopId) params.push(`shopId=${encodeURIComponent(opts.shopId)}`);
  const q = params.length ? `?${params.join('&')}` : '';
  return await jumiaFetch(`/orders${q}`);
}

export async function getOrderItems(orderId: string) {
  if (!orderId) throw new Error('orderId required');
  return await jumiaFetch(`/orders/items?orderId=${encodeURIComponent(orderId)}`);
}


