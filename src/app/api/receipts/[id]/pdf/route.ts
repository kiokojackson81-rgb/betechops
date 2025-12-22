import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ParamsContext {
  params: { id: string };
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const receiptId = context?.params?.id;
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

    const upstream = await fetch(file.url);
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch upstream PDF' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'no-store');

    const arrayBuffer = await upstream.arrayBuffer();
    return new Response(arrayBuffer, { status: 200, headers });
  } catch (error) {
    console.error('[api/receipts/[id]/pdf] error', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
