import { NextRequest, NextResponse } from 'next/server';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channels = Array.isArray(body?.channels) ? body.channels : [];
  try {
    const res = await sendReceiptChannels(params.id, channels);
    return NextResponse.json({ ok: true, res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
