import { buildReceiptPdfResponse } from '@/lib/receiptPdfResponse';
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
  const req = _req;
  const { id: receiptId } = await resolveParams(context);
  if (!receiptId) {
    return new Response(JSON.stringify({ error: 'Missing receipt id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const search = req.nextUrl.searchParams;
    const asDownload = search.get('download') === '1';
    const allowCached = search.get('cached') === '1';
    return buildReceiptPdfResponse(receiptId, { asDownload, allowCached, fileNamePrefix: `receipt-${receiptId}` });
  } catch (error) {
    console.error('[api/receipts/[id]/pdf] error', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
