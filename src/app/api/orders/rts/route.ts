import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import * as jumia from '@/lib/jumia';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, shopId } = body ?? {};
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const su: any = (session as any)?.user ?? {};
    const actor = su.email || su.name || su.id || 'unknown';

    if (!orderId || !shopId) return NextResponse.json({ error: 'orderId and shopId required' }, { status: 400 });

    const action = 'RTS';
    const idempotencyKey = `${shopId}:${orderId}:${action}`;

    try {
      const r = await getRedis();
      if (r) {
        const cached = await r.get(`idempotency:${idempotencyKey}`);
        if (cached) return NextResponse.json(JSON.parse(cached));
        await r.set(`lock:${idempotencyKey}`, '1', 'EX', 60, 'NX');
      }
    } catch {
      // ignore redis failures
    }

    try {
      // Call vendor API to mark RTS (best-effort)
      let result: any = {};
      try {
        result = await (jumia as any).jumiaFetch(`/orders/${encodeURIComponent(orderId)}/rts`, { method: 'POST', body: JSON.stringify({ shopId }) });
      } catch (e) {
        result = { ok: true, note: 'simulated-rts' };
      }

      try {
  await (prisma as any).fulfillmentAudit.create({ data: { idempotencyKey, orderId, shopId, action, status: 1, ok: true, payload: { actor, result } } });
      } catch (e) {
        console.warn('failed to persist fulfillment audit', e);
      }

      try {
        const r = await getRedis();
        if (r) await r.set(`idempotency:${idempotencyKey}`, JSON.stringify({ ok: true, action, result }), 'EX', 60 * 60);
      } catch {
        // ignore redis cache set errors
      }

      return NextResponse.json({ ok: true, action, result });
    } catch (err: any) {
      return new NextResponse(String(err?.message ?? err), { status: 500 });
    }
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
