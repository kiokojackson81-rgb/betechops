import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as any).params;
  if (maybePromise && typeof maybePromise.then === 'function') {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(req: NextRequest, context: ParamsContext) {
  const { id: receiptId } = await resolveParams(context);
  try {
    const file = await prisma.receiptFile.findFirst({
      where: { receiptId, contentType: 'application/pdf', url: { not: '' } },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!file || !file.url) {
      return new Response(JSON.stringify({ error: 'PDF not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const upstream = await fetch(file.url);
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch upstream PDF' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'no-store');

    const arrayBuffer = await upstream.arrayBuffer();
    return new Response(arrayBuffer, { status: 200, headers });
  } catch (e) {
    console.error('[api/receipts/[id]/pdf] error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
