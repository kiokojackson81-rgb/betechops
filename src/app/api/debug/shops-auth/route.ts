import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, non-secret diagnostic: enumerate shops and indicate whether per-shop
// credentials exist in DB (JSON on Shop, ApiCredential rows, or ShopApiConfig).
// Does NOT return secrets; only booleans and minimal strings like scope and apiBase host.
// GET /api/debug/shops-auth
export async function GET() {
  // Helper: scan env for per-shop variables and produce a non-secret summary
  function summarizeEnvShops() {
    const env = process.env || {};
    const sids = new Set<string>();
    const sidFromKey = (key: string, pattern: RegExp, idx = 1) => {
      const m = key.match(pattern);
      if (m && m[idx]) sids.add(String(m[idx]).toUpperCase());
    };
    for (const k of Object.keys(env)) {
      // Patterns we support in loader
      sidFromKey(k, /^SHOP_([A-Z0-9_]+)_JUMIA_CLIENT_ID$/);
      sidFromKey(k, /^SHOP_([A-Z0-9_]+)_JUMIA_REFRESH_TOKEN$/);
      sidFromKey(k, /^SHOP_([A-Z0-9_]+)_(?:BASE_URL|JUMIA_API_BASE)$/);
      sidFromKey(k, /^JUMIA_CLIENT_ID__([A-Z0-9_]+)$/);
      sidFromKey(k, /^JUMIA_REFRESH_TOKEN__([A-Z0-9_]+)$/);
      sidFromKey(k, /^(?:JUMIA_API_BASE|BASE_URL)__([A-Z0-9_]+)$/);
      sidFromKey(k, /^OIDC_CLIENT_ID__([A-Z0-9_]+)$/);
      sidFromKey(k, /^OIDC_REFRESH_TOKEN__([A-Z0-9_]+)$/);
    }
    const rows = Array.from(sids).sort().map((sid) => {
      const pick = (...keys: string[]) => keys.map((k) => env[k]).find((v) => typeof v === 'string' && v.length > 0);
      const clientId = pick(`SHOP_${sid}_JUMIA_CLIENT_ID`, `JUMIA_CLIENT_ID__${sid}`, `OIDC_CLIENT_ID__${sid}`);
      const refreshToken = pick(
        `SHOP_${sid}_JUMIA_REFRESH_TOKEN`,
        `JUMIA_REFRESH_TOKEN__${sid}`,
        `OIDC_REFRESH_TOKEN__${sid}`,
      );
      const apiBase = pick(
        `SHOP_${sid}_BASE_URL`,
        `SHOP_${sid}_JUMIA_API_BASE`,
        `JUMIA_API_BASE__${sid}`,
        `BASE_URL__${sid}`,
      );
      return {
        sid,
        hasClientId: Boolean(clientId),
        hasRefreshToken: Boolean(refreshToken),
        apiBaseHost: apiBase ? (() => { try { return new URL(String(apiBase)).host; } catch { return String(apiBase); } })() : undefined,
        recommendedKeys: {
          clientId: [`SHOP_${sid}_JUMIA_CLIENT_ID`, `JUMIA_CLIENT_ID__${sid}`],
          refreshToken: [`SHOP_${sid}_JUMIA_REFRESH_TOKEN`, `JUMIA_REFRESH_TOKEN__${sid}`],
          apiBase: [`SHOP_${sid}_BASE_URL`, `SHOP_${sid}_JUMIA_API_BASE`, `JUMIA_API_BASE__${sid}`],
        },
      };
    });
    const globalEnv = {
      clientIdSet: Boolean(env.JUMIA_CLIENT_ID || env.OIDC_CLIENT_ID),
      hasRefreshToken: Boolean(env.JUMIA_REFRESH_TOKEN || env.OIDC_REFRESH_TOKEN),
      apiBase: env.base_url || env.BASE_URL || env.JUMIA_API_BASE || undefined,
    };
    return { rows, globalEnv };
  }

  try {
    const shops = await prisma.shop.findMany({
      orderBy: { name: 'asc' },
      include: { apiCredentials: true, apiConfig: true },
    });

    const rows = shops.map((s) => {
      const hasJson = !!(s as any).credentialsEncrypted;
      const creds = Array.isArray((s as any).apiCredentials) ? (s as any).apiCredentials : [];
      const hasApiCred = creds.length > 0;
      const cfg = (s as any).apiConfig || null;
      const hasApiConfig = !!cfg;
      // summarize credentials without secrets
      const apiCredSummary = creds.map((c: any) => ({
        id: c.id,
        scope: c.scope,
        apiBase: c.apiBase || undefined,
        hasClientId: Boolean(c.clientId),
        hasRefreshToken: Boolean(c.refreshToken),
        createdAt: c.createdAt,
      }));
      return {
        id: s.id,
        name: s.name,
        platform: s.platform,
        hasCredentialsJson: hasJson,
        hasApiCredentialRow: hasApiCred,
        hasApiConfig,
        apiCredentials: apiCredSummary,
        apiConfig: cfg ? { id: cfg.id, apiKeySet: Boolean((cfg as any).apiKey), apiSecretSet: Boolean((cfg as any).apiSecret), createdAt: (cfg as any).createdAt } : null,
      };
    });

    return NextResponse.json({ ok: true, source: 'DB', shops: rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (e) {
    // DB unavailable. Fall back to env-based inspection so operators can still
    // see which per-shop variables exist. This returns no secrets.
    const { rows, globalEnv } = summarizeEnvShops();
    return NextResponse.json({
      ok: true,
      source: 'ENV',
      message: 'Database unavailable; reporting per-shop credentials inferred from environment variables only.',
      shopsFromEnv: rows,
      globalEnv,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  }
}
