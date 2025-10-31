import { NextResponse } from "next/server";
import { diagnoseOidc, loadShopAuthById } from "@/lib/jumia";
import { getJumiaTokenInfo, getJumiaAccessToken } from '@/lib/oidc';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const test = searchParams.get("test") === "true";
  const shopId = searchParams.get("shopId") || undefined;
  const diag = await diagnoseOidc({ test });

  const tokenInfo = getJumiaTokenInfo();
  const payload: Record<string, unknown> = {
    issuer: diag.issuer,
    clientIdSet: diag.clientIdSet,
    hasClientSecret: diag.hasClientSecret,
    hasRefreshToken: diag.hasRefreshToken,
    tokenUrl: tokenInfo.tokenUrl || null,
  };

  if (test) {
    // attempt to mint and report success/ttl, but do not return token
    try {
      const now = Date.now();
      await getJumiaAccessToken();
      const info = getJumiaTokenInfo();
      const expiresIn = info.expiresAt ? Math.max(0, Math.floor((info.expiresAt - now) / 1000)) : undefined;
      payload.mintOk = true;
      payload.expiresIn = expiresIn;
    } catch (e) {
      payload.mintOk = false;
      payload.mintError = e instanceof Error ? e.message : String(e);
    }
  }

    // Optional: test per-shop credentials if shopId is provided (uses DB or per-shop ENV overrides)
    if (shopId) {
      try {
        const auth = await loadShopAuthById(shopId).catch(() => undefined);
        if (auth?.clientId && auth?.refreshToken) {
          const tok = await getJumiaAccessToken(auth as any);
          const info = getJumiaTokenInfo();
          payload.shopMint = { ok: true, source: (tok as any)?._meta?.source || 'SHOP', tokenUrl: (tok as any)?._meta?.tokenUrl || null };
        } else {
          payload.shopMint = { ok: false, error: "No shop credentials found (DB/ENV)" };
        }
      } catch (e) {
        payload.shopMint = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

  if (diag.test) payload.test = diag.test;
  return NextResponse.json(payload);
}
