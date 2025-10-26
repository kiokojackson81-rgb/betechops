import { NextResponse } from 'next/server';
import { upsertAssignments } from '@/lib/assignments';

// TODO: replace with real auth extraction & permission checks
async function requireAuth(req: Request) {
  return { id: (req.headers.get('x-user-id') || ''), role: (req.headers.get('x-user-role') || 'SUPERVISOR') };
}

export async function POST(req: Request) {
  const user = await requireAuth(req);
  if (!user.id) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // Only supervisors/admins allowed
  if (!['SUPERVISOR', 'ADMIN'].includes(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const { userId, entries } = body as { userId: string; entries: { shopId: string; role: 'SUPERVISOR' | 'ATTENDANT' }[] };
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await upsertAssignments(userId, entries || []);
  return NextResponse.json({ ok: true });
}
