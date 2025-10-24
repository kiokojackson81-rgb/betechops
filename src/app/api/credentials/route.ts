import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function GET() {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;
  const creds = await prisma.apiCredential.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(creds);
}

export async function POST(request: Request) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;
  const body = (await request.json().catch(() => ({}))) as { scope?: string; apiBase?: string; apiKey?: string; apiSecret?: string; issuer?: string; clientId?: string; refreshToken?: string; shopId?: string };
  const { scope = 'GLOBAL', apiBase = '', apiKey, apiSecret, issuer, clientId, refreshToken, shopId } = body;
  const created = await prisma.apiCredential.create({ data: { scope, apiBase, apiKey, apiSecret, issuer, clientId, refreshToken, shopId } });
  return NextResponse.json(created, { status: 201 });
}
