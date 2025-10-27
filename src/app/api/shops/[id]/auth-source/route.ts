import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShopAuthSchema } from "@/lib/oidc";
import { getJumiaAccessToken } from "@/lib/oidc";

export async function POST(req: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  // Pull only the credentials field from DB (adjust field name if needed)
  const shop = await prisma.shop.findUnique({
    where: { id },
    select: { id: true, name: true, platform: true, credentialsEncrypted: true, apiConfig: true },
  });

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  // Parse/normalize the stored JSON to our expected shape
  // Prefer credentialsEncrypted (JSON) stored on the shop; fall back to apiConfig if present
  const rawCreds = (shop as any).credentialsEncrypted ?? (shop as any).apiConfig ?? {};
  const parsed = ShopAuthSchema.partial().parse(rawCreds ?? {});
  // Ensure platform is visible to the token helper (default JUMIA)
  if (!parsed.platform) parsed.platform = (shop.platform as any) || "JUMIA";

  try {
    const tok = await (getJumiaAccessToken as any)(parsed);
    // tok may be string (legacy) or AccessToken with _meta
    const meta = typeof tok === 'string' ? undefined : tok._meta;
    return NextResponse.json({
      ok: true,
      shopId: shop.id,
      shopName: shop.name,
      platform: parsed.platform,
      source: meta?.source ?? "ENV",
      tokenUrl: meta?.tokenUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, shopId: shop.id, error: e?.message || "Token exchange failed" },
      { status: 500 }
    );
  }
}
