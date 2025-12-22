import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const params = (context as any).params;
  if (params && typeof params.then === 'function') {
    return params as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { id: receiptId } = await resolveParams(context);
  if (!receiptId) {
    return new Response(JSON.stringify({ error: 'Missing receipt id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const file = await prisma.receiptFile.findFirst({
      where: { receiptId, contentType: 'application/pdf', url: { not: '' } },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!file?.url) {
      return new Response(JSON.stringify({ error: 'PDF not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(file.url, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: 'Failed to fetch upstream PDF' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'no-store');
    headers.set('Content-Disposition', `inline; filename="receipt-${receiptId}.pdf"`);
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('[api/receipts/[id]/receipt.pdf] error', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
