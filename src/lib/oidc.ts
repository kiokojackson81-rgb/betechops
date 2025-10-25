/**
 * Minimal OIDC helper for client_credentials / refresh_token flows.
 * - Reads OIDC_XXX env vars
 * - Fetches discovery document from OIDC_ISSUER
 * - Uses token_endpoint from discovery to request tokens
 * - Caches token in-memory until expiry
 */
const cache: Record<string, { accessToken: string; exp: number }> = {};

async function fetchDiscovery(issuer: string) {
  const url = `${issuer.replace(/\/?$/, "")}/.well-known/openid-configuration`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text().catch(() => r.statusText);
    throw new Error(`Failed to fetch discovery document: ${r.status} ${txt} (url: ${url})`);
  }
  return r.json();
}

async function requestToken(tokenUrl: string, body: URLSearchParams) {
  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`OIDC token fetch failed: ${r.status} ${msg} (endpoint: ${tokenUrl})`);
  }
  return r.json();
}

export async function getAccessTokenFromEnv(): Promise<string> {
  const issuer = process.env.OIDC_ISSUER || "";
  const clientId = process.env.OIDC_CLIENT_ID || "";
  const clientSecret = process.env.OIDC_CLIENT_SECRET || "";
  const refreshToken = process.env.OIDC_REFRESH_TOKEN || "";

  if (!issuer || !clientId) throw new Error("OIDC_ISSUER and OIDC_CLIENT_ID must be set in env to obtain tokens");

  const cacheKey = clientId;
  const now = Date.now();
  if (cache[cacheKey] && cache[cacheKey].exp && now < cache[cacheKey].exp - 60_000) {
    return cache[cacheKey].accessToken;
  }

  const disc = await fetchDiscovery(issuer);
  const tokenEndpoint = disc.token_endpoint;
  if (!tokenEndpoint) throw new Error("discovery document did not contain token_endpoint");

  let tokenResp: any;
  if (refreshToken) {
    const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });
    if (clientSecret) body.set("client_secret", clientSecret);
    tokenResp = await requestToken(tokenEndpoint, body);
  } else {
    if (!clientSecret) throw new Error("OIDC_CLIENT_SECRET must be set for client_credentials flow");
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
    tokenResp = await requestToken(tokenEndpoint, body);
  }

  const expiresIn = Number(tokenResp.expires_in || 300);
  cache[cacheKey] = { accessToken: tokenResp.access_token, exp: now + expiresIn * 1000 };
  return cache[cacheKey].accessToken;
}

export function clearOidcCache() {
  for (const k of Object.keys(cache)) delete cache[k];
}

export default { getAccessTokenFromEnv, clearOidcCache };
