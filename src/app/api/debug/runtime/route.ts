import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveJumiaConfig, loadDefaultShopAuth } from "@/lib/jumia";
import { getJumiaAccessToken } from "@/lib/oidc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const origin = host ? `${proto}://${host}` : "";

    const hasDB = Boolean(process.env.DATABASE_URL);
    const hasKey = Boolean(process.env.SECURE_JSON_KEY);

    const shopAuth = await loadDefaultShopAuth().catch(() => undefined);
    const resolved = await resolveJumiaConfig({ shopAuth: shopAuth ?? undefined });

    let tokenMeta: { source?: string; tokenUrl?: string } | undefined;
    let authError: string | undefined;
    try {
      if (shopAuth) {
        const t: any = await getJumiaAccessToken(shopAuth as any);
        tokenMeta = (t?._meta as any) || undefined;
      }
    } catch (e: any) {
      authError = e?.message || String(e);
    }

    return NextResponse.json({
      origin,
      absOrders: origin ? `${origin}/api/orders` : "/api/orders",
      env: { hasDB, hasKey },
      jumia: { base: resolved.base, scheme: resolved.scheme },
      shopAuthPresent: Boolean((shopAuth as any)?.clientId && (shopAuth as any)?.refreshToken),
      tokenMeta,
      authError,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
