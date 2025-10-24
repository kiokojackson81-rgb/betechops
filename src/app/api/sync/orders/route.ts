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
    return NextResponse.json({ shops: shops.map((s: any) => ({ id: s.id, name: s.name, platform: s.platform, hasCredentials: Boolean(s.credentialsEncrypted) })) });
  }

  const results: Record<string, any> = {};
  const { upsertNormalizedOrder } = await import('@/lib/sync/upsertOrder');
  for (const s of shops as any[]) {
    try {
      if (s.platform === 'JUMIA') {
        const orders = await fetchOrdersForShop(s.id);
        const saved: any[] = [];
        for (const o of orders) {
          const r = await upsertNormalizedOrder(o as any).catch((e: any) => ({ error: String(e?.message || e) }));
          saved.push(r);
        }
        results[s.id] = { count: orders.length, savedCount: saved.filter(x=>!x?.error).length };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as any);
          const items = await kmFetchOrders({ appId: creds.storeId || creds.appId, appSecret: creds.appSecret || creds.app_secret, apiBase: creds.apiBase }, { since: undefined });
          const saved: any[] = [];
          for (const o of items) {
            const norm = (await import('@/lib/connectors/normalize')).normalizeFromKilimall(o, s.id);
            const r = await upsertNormalizedOrder(norm as any).catch((e: any) => ({ error: String(e?.message || e) }));
            saved.push(r);
          }
          results[s.id] = { count: items.length, savedCount: saved.filter(x=>!x?.error).length };
        } else {
          results[s.id] = { error: 'no credentials' };
        }
      }
    } catch (e: any) {
      results[s.id] = { error: String(e?.message || e) };
    }
  }

  return NextResponse.json({ results });
}
