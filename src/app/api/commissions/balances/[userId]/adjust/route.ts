import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Next 16 context.params is a Promise in typed App Router handlers; accept both shapes.
export async function POST(req: NextRequest, context: { params: { userId: string } } | { params: Promise<{ userId: string }> }) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => ({}));
  const { amount = 0, reason = 'adjustment' } = body as any;
  try {
    const { userId } = 'params' in context && typeof (context as any).params?.then === 'function'
      ? await (context as { params: Promise<{ userId: string }> }).params
      : (context as { params: { userId: string } }).params;
    const amt = Number(amount || 0);
    const bal = await prisma.balance.upsert({ where: { userId }, create: { userId, available: amt, pending: 0 }, update: { available: { increment: amt } as any } as any });
    await prisma.actionLog.create({ data: { actorId: (guard.session?.user as any)?.id ?? 'system', entity: 'Balance', entityId: userId, action: 'ADJUST', before: null, after: bal } });
    return NextResponse.json({ ok: true, balance: bal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
