import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptJsonForStorage } from '@/lib/crypto/secure-json';
import { requireRole } from '@/lib/api';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const { name, platform, credentials } = body as any;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const encrypted = credentials ? encryptJsonForStorage(credentials) : null;
  const shop = await prisma.shop.create({ data: { name, platform, credentialsEncrypted: encrypted } as any });
  return NextResponse.json(shop, { status: 201 });
}
