import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { fetchOrdersForShop } from '@/lib/jumia';
import { fetchOrders as kmFetchOrders } from '@/lib/connectors/kilimall';
import { decryptJson } from '@/lib/crypto/secure-json';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const simulate = url.searchParams.get('simulate') === 'true';

  const shops = await prisma.shop.findMany();
  if (simulate) {
    return NextResponse.json({ shops: shops.map((s) => ({ id: s.id, name: s.name, platform: s.platform, hasCredentials: Boolean(s.credentialsEncrypted) })) });
  }

  const results: Record<string, unknown> = {};
  const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const { upsertNormalizedOrder } = await import('@/lib/sync/upsertOrder');
  for (const s of shops) {
    try {
      if (s.platform === 'JUMIA') {
  const orders = await fetchOrdersForShop(s.id);
  const saved: unknown[] = [];
        for (const o of orders) {
          const r = await upsertNormalizedOrder(o).catch((e: unknown) => ({ error: errMessage(e) }));
          saved.push(r as unknown);
        }
        results[s.id] = { count: orders.length, savedCount: saved.filter(x => !((x as Record<string, unknown>)?.error)).length };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as { payload: string });
          const credObj = creds as Record<string, unknown>;
          const items = (await kmFetchOrders({ appId: (credObj?.storeId as string) || (credObj?.appId as string), appSecret: (credObj?.appSecret as string) || (credObj?.app_secret as string), apiBase: (credObj?.apiBase as string) }, { since: undefined })) as unknown[];
          const saved: unknown[] = [];
          for (const o of items) {
              const norm = (await import('@/lib/connectors/normalize')).normalizeFromKilimall(o as unknown, s.id);
              const r = await upsertNormalizedOrder(norm).catch((e: unknown) => ({ error: errMessage(e) }));
            saved.push(r as unknown);
          }
          results[s.id] = { count: items.length, savedCount: saved.filter(x => !((x as Record<string, unknown>)?.error)).length };
        } else {
          results[s.id] = { error: 'no credentials' };
        }
      }
    } catch (e: unknown) {
      results[s.id] = { error: errMessage(e) };
    }
  }

  return NextResponse.json({ results });
}
