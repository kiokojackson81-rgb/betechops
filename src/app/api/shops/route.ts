// app/api/shops/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptJsonForStorage } from '@/lib/crypto/secure-json';
import type { Prisma, Platform } from '@prisma/client';
import { requireRole } from '@/lib/api';
import { z } from 'zod';

export const dynamic = "force-dynamic";

export async function GET() {
  const shops = await prisma.shop.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(shops);
}

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  try {
    const body = (await request.json().catch(() => null)) as { name?: string; platform?: string; credentials?: unknown } | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { name, platform, credentials } = body;

  const CredSchema = z.object({
    platform: z.enum(["JUMIA", "KILIMALL"]).optional(),
    apiBase: z.string().url().optional(),
    base_url: z.string().url().optional(),
    tokenUrl: z.string().url(),
    clientId: z.string().min(6),
    refreshToken: z.string().min(10),
    authType: z.enum(["SELF_AUTHORIZATION"]).default("SELF_AUTHORIZATION"),
    shopLabel: z.string().optional(),
  }).passthrough();

  const CreateShopSchema = z.object({
    name: z.string().min(2),
    platform: z.enum(["JUMIA", "KILIMALL"]),
    credentials: CredSchema,
  });

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const parsed = CreateShopSchema.safeParse({ name, platform, credentials });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const encrypted = parsed.data.credentials ? encryptJsonForStorage(parsed.data.credentials) : null;
    const shop = await prisma.shop.create({ data: { name: parsed.data.name, platform: parsed.data.platform as Platform, credentialsEncrypted: encrypted as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ shop }, { status: 201 });
  } catch (e: unknown) {
    // Ensure we always return JSON from this route (avoid HTML error pages)
    const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as any).message) : String(e ?? 'Server error');
    console.error("POST /api/shops failed:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
