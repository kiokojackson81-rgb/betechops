import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function startOfWeekUTC(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type ReconcileWeek = {
  weekStart: string;
  weekEnd: string;
  payoutRows: number;
  totalGross: number;
  totalPayout: number;
  weeklySum: number;
  duplicates: number;
  missingSids: number;
};

export async function reconcileWeeks(weeks = 8): Promise<ReconcileWeek[]> {
  const results: ReconcileWeek[] = [];
  const today = new Date();
  for (let i = 0; i < weeks; i++) {
    const ref = new Date(today);
    ref.setUTCDate(ref.getUTCDate() - i * 7);
    const weekStart = startOfWeekUTC(ref);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });

    let totalGross = 0;
    let totalPayout = 0;
    const byStatement = new Map<string, any[]>();
    const missingSids = new Set<string>();
    for (const r of rows) {
      totalGross += Number(r.grossSales ?? 0);
      totalPayout += Number(r.payoutAmount ?? r.grossSales ?? 0);
      const sn = r.statementNumber ?? '(none)';
      const arr = byStatement.get(sn) ?? [];
      arr.push(r);
      byStatement.set(sn, arr);
      const sid = (r.rawPayload as any)?.shopSid ?? null;
      if (sid) {
        const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
        if (!acct) missingSids.add(sid);
      }
    }

    let duplicates = 0;
    for (const [, arr] of byStatement) if (arr.length > 1) duplicates++;

    const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
    const weeklySum = Number(weeklySale._sum.amount ?? 0);

    results.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      payoutRows: rows.length,
      totalGross,
      totalPayout,
      weeklySum,
      duplicates,
      missingSids: missingSids.size,
    });
  }
  return results;
}
