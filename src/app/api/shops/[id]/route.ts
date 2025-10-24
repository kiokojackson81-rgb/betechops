import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptJsonForStorage } from '@/lib/crypto/secure-json';
import type { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/api';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; isActive?: boolean | string; credentials?: unknown };
  const { name, isActive, credentials } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (credentials !== undefined) data.credentialsEncrypted = encryptJsonForStorage(credentials);

  const shop = await prisma.shop.update({ where: { id }, data: data as unknown as Prisma.ShopUpdateInput });
  return NextResponse.json(shop);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'SUPERVISOR']);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // return a safe subset (do not return credentialsEncrypted)
  const rest = {
    id: shop.id,
    name: shop.name,
    platform: shop.platform,
    isActive: shop.isActive,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
    email: shop.email,
    phone: shop.phone,
    location: shop.location,
  };
  return NextResponse.json(rest);
}
