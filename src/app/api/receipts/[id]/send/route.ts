import { NextRequest, NextResponse } from 'next/server';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: ParamsContext) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channels = Array.isArray(body?.channels) ? body.channels : [];
  try {
    const { id } = 'params' in context && typeof (context as any).params?.then === 'function'
      ? await (context as { params: Promise<{ id: string }> }).params
      : (context as { params: { id: string } }).params;
    const res = await sendReceiptChannels(id, channels);
    return NextResponse.json({ ok: true, res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
