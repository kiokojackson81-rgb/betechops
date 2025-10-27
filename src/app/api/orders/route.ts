import { NextRequest, NextResponse } from 'next/server';
import { jumiaFetch } from '@/lib/jumia';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qs: Record<string, string> = {};
  const allow = ['status', 'size', 'country', 'shopId', 'dateFrom', 'dateTo', 'nextToken', 'q'];
  allow.forEach((k) => {
    const v = url.searchParams.get(k);
    if (v) qs[k] = v;
  });

  if (!qs.size) qs.size = '50';

  const query = new URLSearchParams(qs).toString();
  const path = query ? `orders?${query}` : 'orders';

  try {
    const data = await jumiaFetch(path, { method: 'GET' });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(JSON.stringify({ error: msg }), { status: 500 });
  }
}
