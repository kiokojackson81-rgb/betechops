import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, non-secret diagnostic: enumerate shops and indicate whether per-shop
// credentials exist in DB (JSON on Shop, ApiCredential rows, or ShopApiConfig).
// Does NOT return secrets; only booleans and minimal strings like scope and apiBase host.
// GET /api/debug/shops-auth
export async function GET() {
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

    return NextResponse.json({ ok: true, shops: rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
