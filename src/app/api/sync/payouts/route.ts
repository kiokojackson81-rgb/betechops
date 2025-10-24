import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { fetchPayoutsForShop } from '@/lib/jumia';
import { decryptJson } from '@/lib/crypto/secure-json';
import { fetchPayouts as kmFetchPayouts } from '@/lib/connectors/kilimall';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const day = url.searchParams.get('day') || undefined;

  const shops = await prisma.shop.findMany();
  const results: Record<string, unknown> = {};
  const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
  for (const s of shops) {
    try {
      if (s.platform === 'JUMIA') {
        const payouts = await fetchPayoutsForShop(s.id, { day });
        results[s.id] = { ok: true, payoutsCount: Array.isArray(payouts) ? payouts.length : 1 };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as { payload: string });
          const credObj = creds as Record<string, unknown>;
          const j = await kmFetchPayouts({ appId: (credObj?.storeId as string) || (credObj?.appId as string), appSecret: (credObj?.appSecret as string) || (credObj?.app_secret as string), apiBase: (credObj?.apiBase as string) }, { day });
          results[s.id] = { ok: true, payload: j };
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
