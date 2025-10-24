import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptJsonForStorage } from '@/lib/crypto/secure-json';
import { requireRole } from '@/lib/api';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, isActive, credentials } = body as any;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (credentials !== undefined) data.credentialsEncrypted = encryptJsonForStorage(credentials);

  const shop = await prisma.shop.update({ where: { id }, data });
  return NextResponse.json(shop);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'SUPERVISOR']);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // do not return credentialsEncrypted
  const { credentialsEncrypted, ...rest } = shop as any;
  return NextResponse.json(rest);
}
