import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import type { Prisma } from '@prisma/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<{ scope: string; apiBase: string; apiKey: string; apiSecret: string; issuer: string; clientId: string; refreshToken: string; shopId: string }>;
  const data: Prisma.ApiCredentialUpdateInput = {} as Prisma.ApiCredentialUpdateInput;
  if (body.scope !== undefined) data.scope = body.scope as string;
  if (body.apiBase !== undefined) data.apiBase = body.apiBase as string;
  if (body.apiKey !== undefined) data.apiKey = body.apiKey as string;
  if (body.apiSecret !== undefined) data.apiSecret = body.apiSecret as string;
  if (body.issuer !== undefined) data.issuer = body.issuer as string;
  if (body.clientId !== undefined) data.clientId = body.clientId as string;
  if (body.refreshToken !== undefined) data.refreshToken = body.refreshToken as string;
  if (body.shopId !== undefined) data.shop = { connect: { id: body.shopId } } as Prisma.ShopUpdateOneWithoutApiCredentialsNestedInput;
  const updated = await prisma.apiCredential.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  await prisma.apiCredential.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
