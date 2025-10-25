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
    salesToday?: string;            // e.g., '/reports/sales?range=today'
    pendingPricing?: string;        // e.g., '/orders?status=pending-pricing'
    returnsWaitingPickup?: string;  // e.g., '/returns?status=waiting-pickup'
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
    apiBase: process.env.JUMIA_API_BASE,
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
    if (process.env.JUMIA_OIDC_TOKEN_URL || process.env.JUMIA_REFRESH_TOKEN) {
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
  const envBase = process.env.JUMIA_API_BASE;
  const envScheme = process.env.JUMIA_AUTH_SCHEME;
  if (envBase && envScheme) {
    resolvedConfig = { base: envBase, scheme: envScheme, tried: true };
    return { base: envBase, scheme: envScheme };
  }

  const bases = [
    'https://vendor-api.jumia.com/api',
    'https://vendor-api.jumia.com',
    'https://vendor-api.jumia.com/v1',
    'https://vendor-api.jumia.com/v1/api',
  ];
  const schemes = ['Bearer', 'Token', 'VcToken'];

  // token for probing
  let token = '';
  try { token = await getAccessToken(); } catch (_) { token = '' }

  for (const base of bases) {
    // if explicit base set, skip other bases
    for (const scheme of schemes) {
      const url = `${base.replace(/\/$/, '')}/reports/sales?range=today`;
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

  // final fallback: use env or first base with Bearer
  const fallbackBase = envBase || 'https://vendor-api.jumia.com/api';
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
  const apiBase = process.env.JUMIA_API_BASE || cfg.apiBase || resolved.base;
  if (!apiBase) throw new Error("Missing JUMIA_API_BASE; cannot call Jumia API");
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
  const path = endpoints?.salesToday || "/reports/sales?range=today";
  const j = await jumiaFetch(path);
  // Normalize: support common shapes { total } or { amount } or nested { data: { total } }
  const total = Number(
    j?.total ?? j?.amount ?? j?.data?.total ?? j?.data?.amount ?? 0
  );
  return { total: Number(total) };
}

// Orders pending pricing (normalize to { count })
export async function getPendingPricingCount() {
  const { endpoints } = await loadConfig();
  const path = endpoints?.pendingPricing || "/orders?status=pending-pricing";
  const j = await jumiaFetch(path);
  // Normalize: list-based or count field or nested shapes
  const count = Array.isArray(j?.items)
    ? j.items.length
    : Array.isArray(j?.data)
      ? j.data.length
      : Number(j?.count ?? j?.data?.count ?? 0);
  return { count };
}

// Returns waiting pickup (normalize to { count })
export async function getReturnsWaitingPickup() {
  const { endpoints } = await loadConfig();
  const path = endpoints?.returnsWaitingPickup || "/returns?status=waiting-pickup";
  const j = await jumiaFetch(path);
  const count = Array.isArray(j?.items)
    ? j.items.length
    : Array.isArray(j?.data)
      ? j.data.length
      : Number(j?.count ?? j?.data?.count ?? 0);
  return { count };
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
  // Prefer per-shop ApiCredential lookup when available (caller may pass shop-specific credential retrieval later)
  const path = cfg.endpoints?.pendingPricing || '/orders';
  try {
    const j = await jumiaFetch(path + (opts?.since ? `?since=${encodeURIComponent(opts.since)}` : ''));
    // map results array to normalized orders
    const arr = Array.isArray(j?.items) ? j.items : j?.data || [];
  return arr.map((r: unknown) => normalizeFromJumia(r, shopId));
  } catch (e) {
    throw e;
  }
}

export async function fetchPayoutsForShop(shopId: string, opts?: { day?: string }) {
  const cfg = await loadConfig();
  const path = cfg.endpoints?.salesToday || '/reports/payouts';
  const q = opts?.day ? `?day=${encodeURIComponent(opts.day)}` : '';
  const j = await jumiaFetch(path + q);
  return j;
}

