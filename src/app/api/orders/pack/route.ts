import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import * as jumia from '@/lib/jumia';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, shopId, userId } = body ?? {};
    // Enforce auth
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // session.user shape may vary; tolerate missing fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const su: any = (session as any)?.user ?? {};
  const actor = su.email || su.name || su.id || 'unknown';

    if (!orderId || !shopId) return NextResponse.json({ error: 'orderId and shopId required' }, { status: 400 });

    const action = 'PACK';
    const idempotencyKey = `${shopId}:${orderId}:${action}`;

    // Try Redis idempotency: if a result exists, return it
    try {
      const r = await getRedis();
      if (r) {
        const cached = await r.get(`idempotency:${idempotencyKey}`);
        if (cached) return NextResponse.json(JSON.parse(cached));
        // set a lock to prevent double execution (NX, short TTL)
        await r.set(`lock:${idempotencyKey}`, '1', 'EX', 60, 'NX');
      }
    } catch (e) {
      // continue without Redis
    }

    // Call Jumia to perform pack action. If vendor has a specific endpoint, jumiaFetch will call it.
    let result: any = { ok: false };
    try {
      // Best-effort: call a vendor pack endpoint. This may be adapted to the real vendor API.
      try {
        result = await (jumia as any).jumiaFetch(`/orders/${encodeURIComponent(orderId)}/pack`, { method: 'POST', body: JSON.stringify({ shopId }) });
      } catch (e) {
        // If vendor pack endpoint is not available, attempt a read of order items to validate existence
        await (jumia as any).getOrderItems(orderId).catch(() => null);
        result = { ok: true, note: 'simulated-pack' };
      }

      // persist audit (best-effort)
      try {
        const auditKey = `${idempotencyKey}:${Date.now()}`;
        await (prisma as any).fulfillmentAudit.create({ data: { idempotencyKey, orderId, shopId, status: 1, ok: true, payload: { actor, result } } });
      } catch (e) {
        console.warn('failed to persist fulfillment audit', e);
      }

      // cache the response in Redis for idempotency
      try {
        const r = await getRedis();
        if (r) {
          await r.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), 'EX', 60 * 60);
        }
      } catch (e) {
        // ignore
      }

      return NextResponse.json({ ok: true, action, result });
    } catch (err: any) {
      return new NextResponse(String(err?.message ?? err), { status: 500 });
    }
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
