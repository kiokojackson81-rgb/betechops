// app/api/shops/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const shops = await prisma.shop.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(shops);
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptJsonForStorage } from '@/lib/crypto/secure-json';
import type { Prisma, Platform } from '@prisma/client';
import { requireRole } from '@/lib/api';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as { name?: string; platform?: string; credentials?: unknown };
  const { name, platform, credentials } = body;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const encrypted = credentials ? encryptJsonForStorage(credentials) : null;
  const shop = await prisma.shop.create({ data: { name, platform: (platform as unknown) as Platform, credentialsEncrypted: encrypted as unknown as Prisma.InputJsonValue } });
  return NextResponse.json(shop, { status: 201 });
}
