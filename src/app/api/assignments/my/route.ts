import { NextResponse } from 'next/server';
import { getUserShops } from '@/lib/assignments';

// TODO: replace with real auth extraction
async function requireAuth(req: Request) {
  // placeholder: in production hook into your auth middleware
  return { id: (req.headers.get('x-user-id') || ''), role: (req.headers.get('x-user-role') || 'ATTENDANT') };
}

export async function GET(req: Request) {
  const user = await requireAuth(req);
  if (!user.id) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const shops = await getUserShops(user.id);
  return NextResponse.json({ shops });
}
