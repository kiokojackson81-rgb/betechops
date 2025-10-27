/**
 * Minimal OIDC helper for client_credentials / refresh_token flows.
 * - Reads OIDC_XXX env vars
 * - Fetches discovery document from OIDC_ISSUER
 * - Uses token_endpoint from discovery to request tokens
 * - Caches token in-memory until expiry
 */
// TODO(copilot): Add persistent token cache (Redis) behind getJumiaAccessToken()
// 1) If process.env.REDIS_URL -> use it to store { accessToken, exp } under key `jumia:token`
// 2) Refresh 5 minutes before expiry; fall back to in-memory if Redis unavailable
// 3) Emit metrics: jumia_token_refresh_total{result="ok|fail"}

const cache: Record<string, { accessToken: string; exp: number }> = {};

// Simple per-Jumia cache for the refresh token flow
const jumiaCache: { token?: string; exp?: number; tokenUrl?: string } = {};

// Optional Redis-backed token cache (lazy init). Only used when process.env.REDIS_URL is set.
type PartialRedisLike = {
  ping?: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};
let redisClient: PartialRedisLike | null = null;
let redisAvailable = false;

async function ensureRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
  // dynamic import to avoid hard dependency until runtime
  const mod = await import('ioredis');
  const RedisCtor = ((mod as unknown) as { default?: unknown }).default ?? (mod as unknown);
  // instantiate with minimal typing and avoid `any` by casting via unknown
  redisClient = (new (RedisCtor as unknown as { new (url: string): PartialRedisLike })(process.env.REDIS_URL as string)) as PartialRedisLike;
  // basic ping to confirm connectivity
  await redisClient.ping?.();
    redisAvailable = true;
    return redisClient;
  } catch (err: unknown) {
    // If Redis is unavailable, fall back to in-memory cache
  console.error('Jumia Redis initialization failed, falling back to in-memory token cache:', err instanceof Error ? err.message : String(err));
    redisClient = null;
    redisAvailable = false;
    return null;
  }
}

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

  interface TokenResponse {
    access_token?: string;
    expires_in?: number | string;
    [k: string]: unknown;
  }

  let tokenResp: TokenResponse;
  if (refreshToken) {
    const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });
    if (clientSecret) body.set("client_secret", clientSecret);
    tokenResp = await requestToken(tokenEndpoint, body);
  } else {
    if (!clientSecret) throw new Error("OIDC_CLIENT_SECRET must be set for client_credentials flow");
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
    tokenResp = await requestToken(tokenEndpoint, body);
  }

  const expiresIn = Number(tokenResp.expires_in ?? 300);
  cache[cacheKey] = { accessToken: String(tokenResp.access_token ?? ""), exp: now + expiresIn * 1000 };
  return cache[cacheKey].accessToken;
}

export function clearOidcCache() {
  for (const k of Object.keys(cache)) delete cache[k];
}

// Intentionally no default export to keep named exports explicit

/**
 * Mint an access token specifically for Jumia using the provided
 * JUMIA_OIDC_TOKEN_URL + OIDC_CLIENT_ID + OIDC_REFRESH_TOKEN.
 * Caches token until expiresAt - 60s.
 */
export async function getJumiaAccessToken(): Promise<string> {
  // Prefer explicit JUMIA_OIDC_TOKEN_URL, then generic OIDC token URL, then canonical fallback
  // Per Jumia vendor API spec the token endpoint is exposed at /token
  // Prefer generic OIDC_TOKEN_URL first (so platform-level envs win), then JUMIA_OIDC_TOKEN_URL, then canonical fallback
  const tokenUrl = process.env.OIDC_TOKEN_URL || process.env.JUMIA_OIDC_TOKEN_URL || 'https://vendor-api.jumia.com/token';
  // Prefer standard OIDC env names, fall back to legacy JUMIA_CLIENT_ID
  const clientId = process.env.OIDC_CLIENT_ID || process.env.JUMIA_CLIENT_ID || "";
  // Prefer standard OIDC env names
  const refreshToken = process.env.OIDC_REFRESH_TOKEN || process.env.JUMIA_REFRESH_TOKEN || "";

  if (!tokenUrl) throw new Error("JUMIA_OIDC_TOKEN_URL or OIDC_TOKEN_URL must be set to mint a Jumia token");
  if (!clientId) throw new Error("OIDC_CLIENT_ID (or JUMIA_CLIENT_ID) is not set in env; cannot mint Jumia token");
  if (!refreshToken) throw new Error("OIDC_REFRESH_TOKEN (or JUMIA_REFRESH_TOKEN) is not set in env; cannot mint Jumia token");

  const now = Date.now();

  // 1) check in-memory cache first (fast-path)
  if (jumiaCache.token && jumiaCache.exp && now < (jumiaCache.exp - 60_000)) {
    return jumiaCache.token;
  }

  // 2) If REDIS_URL configured, try Redis before minting a new token
  try {
    const r = await ensureRedis();
    if (r && redisAvailable) {
          try {
            const raw = await r.get('jumia:token');
            if (raw) {
              const parsed = JSON.parse(raw as string);
              const access = String(parsed.access || parsed.accessToken || parsed.token || '');
              const exp = Number(parsed.exp || parsed.expiresAt || 0);
              if (access && exp && now < (exp - 60_000)) {
                // populate in-memory cache and return
                jumiaCache.token = access;
                jumiaCache.exp = exp;
                jumiaCache.tokenUrl = tokenUrl;
                return access;
              }
            }
          } catch {
            // redis read failed -> continue to mint new token
            console.error('Jumia Redis read failed; will mint new token');
          }
    }
  } catch {
    // ignore Redis failures; proceed with minting and fallback to in-memory
  }

  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    // redact secrets from the error message
    const preview = txt.length > 400 ? txt.slice(0, 400) + "..." : txt;
    throw new Error(`Jumia token endpoint returned ${r.status}: ${preview}`);
  }

  let tokenResp: { access_token?: string; expires_in?: number | string } = {};
  try {
    tokenResp = JSON.parse(txt || "{}");
  } catch {
    // if not JSON, surface raw body (already captured above)
    throw new Error(`Jumia token response parse failed; body: ${txt}`);
  }

  const access = String(tokenResp.access_token || "");
  const expiresIn = Number(tokenResp.expires_in ?? 300);
  if (!access) throw new Error("Jumia token response did not include access_token");

  jumiaCache.token = access;
  jumiaCache.exp = now + expiresIn * 1000;
  jumiaCache.tokenUrl = tokenUrl;

  // Persist to Redis (best-effort). Store token and absolute expiry.
  (async () => {
    try {
      const r = await ensureRedis();
      if (r && redisAvailable) {
        const payload = JSON.stringify({ access: access, exp: jumiaCache.exp });
        // set with TTL a bit shorter than expiry to allow refresh window
        const ttl = Math.max(30, Math.floor(expiresIn) - 10);
  await r.set?.('jumia:token', payload, 'EX', ttl);
      }
    } catch (err) {
      // Non-fatal: log and continue
      console.error('Failed to persist Jumia token to Redis; continuing with in-memory cache', err instanceof Error ? err.message : String(err));
    }
  })();
  return access;
}

export function getJumiaTokenInfo() {
  return { tokenUrl: jumiaCache.tokenUrl || process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL, expiresAt: jumiaCache.exp };
}
