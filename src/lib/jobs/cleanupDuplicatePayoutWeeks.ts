import { prisma } from "@/lib/prisma";
import { canonicalNairobiWeekStartUtc, parseDateOnlyUtc } from "@/lib/weekWindow";
import { Prisma } from "@prisma/client";

type PayoutRow = Prisma.MarketplacePayoutWeekGetPayload<{
  include: { account: false };
}>;

export async function cleanupDuplicatePayoutWeeks() {
  const rows = await prisma.marketplacePayoutWeek.findMany({
    select: { id: true, accountId: true, statementNumber: true, weekStart: true, rawPayload: true, updatedAt: true },
    orderBy: [{ accountId: "asc" }, { weekStart: "asc" }],
  });

  const grouped = new Map<string, { accountId: string; weekStart: Date; rows: PayoutRow[] }>();
  for (const row of rows) {
    const canonicalStart = canonicalNairobiWeekStartUtc(new Date(row.weekStart));
    const key = `${row.accountId}::${canonicalStart.toISOString()}`;
    if (!grouped.has(key)) {
      grouped.set(key, { accountId: row.accountId, weekStart: canonicalStart, rows: [] });
    }
    grouped.get(key)!.rows.push(row);
  }

  const cleanupDetails: Array<{ accountId: string; weekStart: string; removed: number }> = [];
  let totalRemoved = 0;

  for (const { accountId, weekStart, rows: duplicates } of grouped.values()) {
    if (duplicates.length <= 1) continue;
    const keeper = chooseKeeperRow(duplicates, weekStart);
    const toRemove = duplicates.filter((r) => r.id !== keeper.id).map((r) => r.id);
    if (toRemove.length === 0) continue;
    await prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: toRemove } } });
    cleanupDetails.push({ accountId, weekStart: weekStart.toISOString(), removed: toRemove.length });
    totalRemoved += toRemove.length;
  }

  return { removed: totalRemoved, details: cleanupDetails };
}

function chooseKeeperRow(rows: PayoutRow[], canonicalWeekStart: Date): PayoutRow {
  let best: { row: PayoutRow; score: number } | null = null;
  for (const row of rows) {
    const rowStart = canonicalNairobiWeekStartUtc(new Date(row.weekStart));
    const diff = Math.abs(rowStart.getTime() - canonicalWeekStart.getTime());
    const payload = row.rawPayload as any;
    const periodStart = parseDateOnlyUtc(payload?.period?.startDate ?? null);
    const periodMatches = periodStart ? canonicalNairobiWeekStartUtc(periodStart).getTime() === canonicalWeekStart.getTime() : false;
    const normalizedNumber = String(row.statementNumber ?? "").toUpperCase();
    const hasSuffix = /(OPEN|PAID|UNPAID)$/.test(normalizedNumber);
    const updatedScore = (row.updatedAt?.getTime() ?? 0) / 1_000_000;
    const score = (periodMatches ? 100 : 0) - diff + (hasSuffix ? 10 : 0) + updatedScore;
    if (!best || score > best.score) {
      best = { row, score };
    }
  }
  return best?.row ?? rows[0];
}
