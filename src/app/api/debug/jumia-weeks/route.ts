import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canonicalNairobiWeekStartUtc } from '@/lib/weekWindow';

// Force server runtime so Prisma Client can be used during production start
export const runtime = 'nodejs';

export async function GET() {
  try {
    const weekStart = canonicalNairobiWeekStartUtc(new Date('2026-01-05T00:00:00.000Z'));
    const lower = new Date(weekStart.getTime() - 24 * 3600 * 1000);
    const upper = new Date(weekStart.getTime() + 24 * 3600 * 1000);

    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart: { gte: lower, lte: upper }, currency: 'KES' },
    });

    const perAccount = {} as Record<string, { accountId: string; displayName?: string | null; total: number }>;
    let grand = 0;
    for (const r of rows) {
      const acc = perAccount[r.accountId] ?? { accountId: r.accountId, displayName: undefined, total: 0 };
      acc.total += Number(r.payoutAmount ?? r.grossSales ?? 0);
      perAccount[r.accountId] = acc;
      grand += Number(r.payoutAmount ?? r.grossSales ?? 0);
    }

    return NextResponse.json({ weekStart: weekStart.toISOString(), countRows: rows.length, perAccount, grandTotal: grand });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
