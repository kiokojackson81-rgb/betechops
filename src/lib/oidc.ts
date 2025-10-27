import { z } from "zod";

type AuthSource = "SHOP" | "ENV";
type ShopAuth = {
  platform?: "JUMIA" | "KILIMALL";
  tokenUrl?: string;
  clientId?: string;
  refreshToken?: string;
};

const redact = (s?: string, keep = 4) =>
  !s ? "" : s.length <= keep ? "****" : `${s.slice(0, keep)}…REDACTED`;

export type AccessToken = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  _meta?: { source: AuthSource; platform?: string; tokenUrl?: string };
};

// Unified token getter: prefers per-shop JSON, falls back to env.
async function getJumiaAccessTokenWithMeta(
  shopAuth?: ShopAuth
): Promise<AccessToken> {
  // 1) Resolve from shop JSON first
  const fromShop = shopAuth?.clientId && shopAuth?.refreshToken;
  const tokenUrl =
    shopAuth?.tokenUrl ||
    process.env.OIDC_TOKEN_URL ||
    process.env.JUMIA_OIDC_TOKEN_URL ||
    "https://vendor-api.jumia.com/token";

  const clientId =
    (fromShop ? shopAuth?.clientId : process.env.OIDC_CLIENT_ID) ||
    process.env.JUMIA_CLIENT_ID;

  const refreshToken =
    (fromShop ? shopAuth?.refreshToken : process.env.OIDC_REFRESH_TOKEN) ||
    process.env.JUMIA_REFRESH_TOKEN;

  const source: AuthSource = fromShop ? "SHOP" : "ENV";

  if (!clientId || !refreshToken) {
    throw new Error(
      "Missing credentials: neither per-shop JSON nor ENV provided clientId & refreshToken."
    );
  }

  // Optional simple in-memory cache keyed by (source+clientId)
  const cacheKey = `${source}:${clientId}`;
  const now = Math.floor(Date.now() / 1000);
  // @ts-expect-error - global cache container for tokens; may not be typed on globalThis
  globalThis.__jumiaTokenCache ??= new Map<string, { token: AccessToken; exp: number }>();
  // @ts-expect-error - global cache container for tokens; may not be typed on globalThis
  const cache = globalThis.__jumiaTokenCache as Map<string, { token: AccessToken; exp: number }>;
  const cached = cache.get(cacheKey);
  if (cached && cached.exp > now + 60) {
    return { ...cached.token, _meta: { source, platform: shopAuth?.platform, tokenUrl } };
  }

  const body = new URLSearchParams({
    client_id: clientId!,
    grant_type: "refresh_token",
    refresh_token: refreshToken!,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    // Structured, safe log (never print full secrets)
    console.error("[OIDC] token exchange FAILED", {
      source,
      tokenUrl,
      platform: shopAuth?.platform ?? "JUMIA",
      clientId: redact(clientId),
      refreshToken: redact(refreshToken),
      status: resp.status,
      body: text.slice(0, 400),
    });
    throw new Error(`OIDC token exchange failed (${resp.status})`);
  }

  const json = (await resp.json()) as AccessToken;
  const exp = now + (json.expires_in ?? 3000);
  cache.set(cacheKey, { token: json, exp });

  // Helpful success log (still redacted)
  console.info("[OIDC] token exchange OK", {
    source,
    tokenUrl,
    platform: shopAuth?.platform ?? "JUMIA",
    clientId: redact(clientId),
    exp,
  });

  return { ...json, _meta: { source, platform: shopAuth?.platform, tokenUrl } };
}

// Backwards-compatible wrapper:
export async function getJumiaAccessToken(): Promise<string>;
export async function getJumiaAccessToken(shopAuth?: ShopAuth): Promise<AccessToken>;
export async function getJumiaAccessToken(shopAuth?: ShopAuth): Promise<any> {
  if (shopAuth === undefined) {
    const tok = (await getJumiaAccessTokenWithMeta(undefined)) as AccessToken;
    return tok.access_token;
  }
  return await getJumiaAccessTokenWithMeta(shopAuth);
}

// Helper to build ShopAuth from DB/JSON credentials
export const ShopAuthSchema = z.object({
  platform: z.enum(["JUMIA", "KILIMALL"]).optional(),
  tokenUrl: z.string().url().optional(),
  clientId: z.string().min(3).optional(),
  refreshToken: z.string().min(10).optional(),
});
export type ShopAuthJson = z.infer<typeof ShopAuthSchema>;

// Backwards-compatible helpers used by other modules
export async function getAccessTokenFromEnv(): Promise<string> {
  // Prefer the standard env-based flow: call getJumiaAccessToken with no shopAuth
  const tokAny = await (getJumiaAccessToken as any)();
  if (typeof tokAny === 'string') return tokAny;
  return (tokAny as AccessToken).access_token;
}

export function getJumiaTokenInfo() {
  // Try to pick a cached entry if available
  // @ts-expect-error - access global cache if present
  const cache = globalThis.__jumiaTokenCache as Map<string, { token: AccessToken; exp: number }> | undefined;
  if (cache && cache.size > 0) {
    for (const [k, v] of cache.entries()) {
      return { tokenUrl: v.token._meta?.tokenUrl || process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL, expiresAt: v.exp * 1000 };
    }
  }
  return { tokenUrl: process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL, expiresAt: undefined };
}
