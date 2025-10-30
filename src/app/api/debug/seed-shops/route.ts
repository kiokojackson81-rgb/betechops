import { NextResponse } from "next/server";
import { Prisma, Platform, PrismaClient } from "@prisma/client";
import { encryptJsonForStorage } from "@/lib/crypto/secure-json";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

type IncomingShop = {
  name: string;
  clientId: string;
  refreshToken: string;
  shopId?: string; // vendor shop id
  apiBase?: string; // defaults to vendor-api.jumia.com
  tokenUrl?: string; // optional override
};

/**
 * POST /api/debug/seed-shops?token=SETUP_TOKEN
 * Body: { shops: IncomingShop[] }
 *
 * Safely upserts multiple Jumia shops by name with per-shop credentials.
 * Stores credentials in Shop.credentialsEncrypted (encrypted when SECURE_JSON_KEY is set).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-setup-token");
  const expected = process.env.SETUP_TOKEN;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { shops?: IncomingShop[] };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const shops = Array.isArray(body.shops) ? body.shops : [];
  if (!shops.length) return NextResponse.json({ ok: false, error: "No shops provided" }, { status: 400 });

  const results: Array<{ name: string; action: "created"|"updated"|"skipped"; id?: string; error?: string }> = [];

  for (const s of shops) {
    const name = String(s.name || "").trim();
    if (!name || !s.clientId || !s.refreshToken) {
      results.push({ name: name || "(missing)", action: "skipped", error: "name, clientId, refreshToken required" });
      continue;
    }
    const apiBase = (s.apiBase || process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE || "https://vendor-api.jumia.com").replace(/\/?$/, "");
    const tokenUrl = s.tokenUrl || process.env.JUMIA_OIDC_TOKEN_URL || process.env.OIDC_TOKEN_URL || `${new URL(apiBase).origin}/token`;
    const creds = {
      platform: "JUMIA",
      apiBase,
      tokenUrl,
      clientId: s.clientId,
      refreshToken: s.refreshToken,
      vendorShopId: s.shopId,
    } as const;

    // Encrypt when key is present; else store plaintext JSON (for dev only)
    let credentialsEncrypted: Prisma.InputJsonValue | null = null;
    try {
      if (process.env.SECURE_JSON_KEY) credentialsEncrypted = encryptJsonForStorage(creds) as unknown as Prisma.InputJsonValue;
      else credentialsEncrypted = creds as unknown as Prisma.InputJsonValue;
    } catch {
      credentialsEncrypted = creds as unknown as Prisma.InputJsonValue;
    }

    try {
      const existing = await prisma.shop.findFirst({ where: { name } });
      const data: Prisma.ShopCreateInput = {
        name,
        platform: Platform.JUMIA,
        isActive: true,
        credentialsEncrypted,
      };
      if (existing) {
        const updated = await prisma.shop.update({ where: { id: existing.id }, data });
        results.push({ name, action: "updated", id: updated.id });
      } else {
        const created = await prisma.shop.create({ data });
        results.push({ name, action: "created", id: created.id });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name, action: "skipped", error: msg });
    }
  }

  return NextResponse.json({ ok: true, results });
}
