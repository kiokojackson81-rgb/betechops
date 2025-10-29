import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJumiaAccessToken, ShopAuthSchema } from "@/lib/oidc";
import { decryptJson } from "@/lib/crypto/secure-json";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shopLabel = url.searchParams.get("shopLabel") || "JM Collection";

    // Find shop by name (label)
    const shop = await prisma.shop.findFirst({
      where: { name: shopLabel },
      select: { id: true, name: true, platform: true, credentialsEncrypted: true, apiConfig: true },
    });

    if (!shop) {
      return NextResponse.json({ ok: false, error: `Shop not found: ${shopLabel}` }, { status: 404 });
    }

    // Prefer credentialsEncrypted (encrypted JSON) then apiConfig
    let rawCreds: any = (shop as any).credentialsEncrypted ?? (shop as any).apiConfig ?? {};
    let credsObj: any = rawCreds;

    // If encrypted, attempt decryption (decryptJson returns undefined if SECURE_JSON_KEY missing)
    if (rawCreds && (rawCreds as any).payload) {
      const dec = decryptJson(rawCreds as { payload: string });
      if (!dec) {
        return NextResponse.json({ ok: false, error: "SECURE_JSON_KEY not set; cannot decrypt shop credentials" }, { status: 500 });
      }
      credsObj = dec;
    }

    // Parse/normalize with ShopAuthSchema (partial) to be resilient to missing fields
    let shopAuth: any = {};
    try {
      shopAuth = ShopAuthSchema.partial().parse(credsObj ?? {});
    } catch (err) {
      // fallback: try to coerce shape
      shopAuth = {};
    }

    // Ensure platform included when available
    if (!shopAuth.platform) shopAuth.platform = (shop as any).platform || "JUMIA";

    // Attempt to mint token using per-shop credentials
    try {
      const token = await getJumiaAccessToken(shopAuth as any);
      // token should be AccessToken with _meta; if legacy string, we can't inspect expires_in
      const tokenObj: any = typeof token === "string" ? { access_token: token } : token;
      return NextResponse.json({ ok: true, expiresIn: tokenObj.expires_in, accessTokenSample: (tokenObj.access_token || "").slice(0, 20) + "..." });
    } catch (e: any) {
      // If the provider returned 404 to token endpoint (e.g., mis-routed vendor base), surface it
      return NextResponse.json({ ok: false, error: e?.message || String(e), stack: e?.stack }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), stack: e?.stack }, { status: 500 });
  }
}
