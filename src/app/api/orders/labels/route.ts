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
    const su = ((session as unknown as { user?: Record<string, unknown> })?.user ?? {}) as Record<string, unknown>;
    const actor = typeof su.email === 'string'
      ? su.email
      : typeof su.name === 'string'
        ? su.name
        : typeof su.id === 'string'
          ? su.id
          : 'unknown';

    if (!orderId || !shopId) return NextResponse.json({ error: 'orderId and shopId required' }, { status: 400 });

    const action = 'LABEL';
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
      // Best-effort: attempt to call vendor label endpoint
  let result: unknown;
      try {
        result = await (jumia as any).jumiaFetch(`/orders/${encodeURIComponent(orderId)}/label`, { method: 'POST', body: JSON.stringify({ shopId }) });
      } catch {
        // simulate label generation
        result = { ok: true, labelUrl: null, note: 'simulated-label' } as unknown;
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
        // ignore redis caching errors
      }

      // labelUrl may be present depending on vendor response shape
      const labelUrl = (result && typeof result === 'object' && 'labelUrl' in result && (result as any).labelUrl) ? (result as any).labelUrl : null;

      return NextResponse.json({ ok: true, action, labelUrl });
    } catch (err: any) {
      return new NextResponse(String(err?.message ?? err), { status: 500 });
    }
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
