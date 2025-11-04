import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api';
import { getShipmentProviders } from '@/lib/jumia';

export async function POST(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { shopId?: string; orderItemIds?: string[] };
  const shopId = String(body.shopId || '').trim();
  const ids = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];
  if (!shopId || !ids.length) return NextResponse.json({ error: 'shopId and orderItemIds are required' }, { status: 400 });
  const providers = await getShipmentProviders({ shopId, orderItemIds: ids }).catch((e) => ({ error: String(e) }));
  return NextResponse.json(providers);
}
