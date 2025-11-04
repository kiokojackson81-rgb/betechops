import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

const CONFIG_KEY = 'jumia:shipper-defaults';

type DefaultsMap = Record<string, { providerId: string; label?: string }>; // shopId -> provider

async function loadDefaults(): Promise<DefaultsMap> {
  const row = await prisma.config.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null);
  const json = (row?.json ?? {}) as unknown;
  if (json && typeof json === 'object') return json as DefaultsMap;
  return {} as DefaultsMap;
}

async function saveDefaults(map: DefaultsMap) {
  await prisma.config.upsert({
    where: { key: CONFIG_KEY },
    update: { json: map },
    create: { key: CONFIG_KEY, json: map },
  });
}

export async function GET() {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const map = await loadDefaults();
  return NextResponse.json({ defaults: map });
}

export async function POST(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { shopId?: string; providerId?: string; label?: string };
  const shopId = String(body.shopId || '').trim();
  const providerId = String(body.providerId || '').trim();
  if (!shopId || !providerId) return NextResponse.json({ error: 'shopId and providerId are required' }, { status: 400 });
  const map = await loadDefaults();
  map[shopId] = { providerId, label: body.label };
  await saveDefaults(map);
  return NextResponse.json({ ok: true, defaults: map });
}

export async function DELETE(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const shopId = url.searchParams.get('shopId') || '';
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });
  const map = await loadDefaults();
  if (map[shopId]) {
    delete map[shopId];
    await saveDefaults(map);
  }
  return NextResponse.json({ ok: true, defaults: map });
}
