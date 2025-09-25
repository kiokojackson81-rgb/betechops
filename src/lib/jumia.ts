const cache: { accessToken?: string; exp?: number } = {};

/**
 * Get an access token using your long-lived REFRESH TOKEN.
 * We cache it in-memory on the server until ~60s before expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache.accessToken && cache.exp && now < cache.exp - 60_000) {
    return cache.accessToken;
  }

  const issuer = process.env.JUMIA_OIDC_ISSUER!;
  const clientId = process.env.JUMIA_CLIENT_ID!;
  const refreshToken = process.env.JUMIA_REFRESH_TOKEN!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const r = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`OIDC token fetch failed: ${r.status} ${msg}`);
  }

  const j = await r.json();
  cache.accessToken = j.access_token;
  cache.exp = now + (Number(j.expires_in || 300) * 1000);
  return cache.accessToken!;
}

/**
 * Wrapper to call Jumia API with Authorization header.
 * Usage: await jumiaFetch("/some/endpoint?param=1")
 */
export async function jumiaFetch(path: string, init: RequestInit = {}) {
  const apiBase = process.env.JUMIA_API_BASE!;
  const token = await getAccessToken();
  const url = `${apiBase}${path}`;
  const bodyPresent = Boolean((init as RequestInit).body);
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
    "Content-Type": bodyPresent ? "application/json" : undefined,
  } as Record<string, string>;

  const r = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`Jumia ${path} failed: ${r.status} ${msg}`);
  }
  return r.json().catch(() => ({}));
}

/* ---- Example helpers (replace paths with your real ones) ---- */

// Sales today (normalize to { total })
export async function getSalesToday() {
  // Example: adjust endpoint/params to your API
  const j = await jumiaFetch(`/reports/sales?range=today`);
  const total = j?.total ?? j?.amount ?? 0;
  return { total: Number(total) };
}

// Orders pending pricing (normalize to { count })
export async function getPendingPricingCount() {
  const j = await jumiaFetch(`/orders?status=pending-pricing`);
  const count = Array.isArray(j?.items) ? j.items.length : Number(j?.count ?? 0);
  return { count };
}

// Returns waiting pickup (normalize to { count })
export async function getReturnsWaitingPickup() {
  const j = await jumiaFetch(`/returns?status=waiting-pickup`);
  const count = Array.isArray(j?.items) ? j.items.length : Number(j?.count ?? 0);
  return { count };
}

