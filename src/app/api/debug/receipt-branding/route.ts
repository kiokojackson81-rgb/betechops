import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBranding } from '@/lib/branding';
import renderReceiptTemplate from '@/app/templates/receiptTemplate';
import { buildReceiptSnapshot } from '@/app/receipts/buildSnapshot';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { order: { include: { items: true, attendant: true } }, issuedBy: true } });
  if (!receipt) return NextResponse.json({ error: 'receipt not found' }, { status: 404 });

  const snapshot = buildReceiptSnapshot(receipt as any);
  const branding = await getBranding();
  const html = renderReceiptTemplate({ ...(snapshot as any), branding }, { hideStamp: false });

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
