import { NextResponse } from "next/server";
import { Prisma, Platform, PrismaClient } from "@prisma/client";
import { encryptJsonForStorage } from "@/lib/crypto/secure-json";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * POST /api/debug/seed-shop?token=SETUP_TOKEN
 * Body: {
 *   name: string,
 *   platform?: "JUMIA"|"KILIMALL",
 *   // credentials JSON (apiBase/base_url, tokenUrl, clientId, refreshToken, ...)
 *   credentials: Record<string, unknown>
 * }
 *
 * Guards:
 * - Requires query ?token= to match process.env.SETUP_TOKEN
 * - Writes or updates a Shop by name, storing credentials (encrypted when SECURE_JSON_KEY set)
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-setup-token");
  const expected = process.env.SETUP_TOKEN;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; platform?: keyof typeof Platform; credentials?: unknown };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || (body as any).shopLabel || "JM Collection").trim();
  const platformKey = (body.platform || "JUMIA") as keyof typeof Platform;
  const platform = Platform[platformKey] ?? Platform.JUMIA;
  const creds = body.credentials ?? {};

  // If we have SECURE_JSON_KEY, store encrypted; otherwise store plaintext JSON
  let credentialsEncrypted: Prisma.InputJsonValue | null = null;
  try {
    if (process.env.SECURE_JSON_KEY) {
      credentialsEncrypted = encryptJsonForStorage(creds as Record<string, unknown>) as unknown as Prisma.InputJsonValue;
    } else {
      credentialsEncrypted = creds as unknown as Prisma.InputJsonValue;
    }
  } catch {
    credentialsEncrypted = creds as unknown as Prisma.InputJsonValue;
  }

  const existing = await prisma.shop.findFirst({ where: { name } });
  const data: Prisma.ShopCreateInput = {
    name,
    platform,
    isActive: true,
    credentialsEncrypted,
  };

  if (existing) {
    const updated = await prisma.shop.update({ where: { id: existing.id }, data });
    return NextResponse.json({ ok: true, action: "updated", shop: updated });
  }

  const created = await prisma.shop.create({ data });
  return NextResponse.json({ ok: true, action: "created", shop: created });
}
