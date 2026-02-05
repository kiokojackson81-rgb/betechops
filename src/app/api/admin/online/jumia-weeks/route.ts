import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mondayToSundayNairobiWindow, formatNairobiDate } from "@/lib/weekWindow";
import { chooseAuthoritativeCandidate } from "@/lib/payoutDeduper";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 90);

  const recentPayouts = await prisma.marketplacePayoutWeek.findMany({
    where: { account: { platform: "JUMIA" }, weekEnd: { gte: lookbackDate } },
    select: {
      accountId: true,
      weekStart: true,
      weekEnd: true,
      statementNumber: true,
      rawPayload: true,
      grossSales: true,
      payoutAmount: true,
      isPaid: true,
      createdAt: true,
      updatedAt: true,
      id: true,
    },
  });

  const weekBucket = new Map<string, { weekStart: Date; weekEnd: Date; accounts: Map<string, any[]> }>();

  for (const row of recentPayouts) {
    const { weekStart: canonicalStart, weekEnd: canonicalEnd } = mondayToSundayNairobiWindow(new Date(row.weekStart));
    const key = canonicalStart.toISOString();
    if (!weekBucket.has(key)) {
      weekBucket.set(key, { weekStart: canonicalStart, weekEnd: canonicalEnd, accounts: new Map() });
    }
    const entry = weekBucket.get(key)!;
    const bucket = entry.accounts.get(row.accountId) ?? [];
    bucket.push(row);
    entry.accounts.set(row.accountId, bucket);
  }

  const allAccounts = await prisma.marketplaceAccount.findMany({ where: { platform: "JUMIA", isActive: true }, select: { id: true } });
  const totalActiveAccounts = allAccounts.length;

  const enrichedWeeks = Array.from(weekBucket.values()).map((entry) => {
    const bestRows = Array.from(entry.accounts.values())
      .map((rows) => {
        const nonPlaceholder = rows.filter((row) => !((row.rawPayload as any)?.placeholder === true));
        const candidates = nonPlaceholder.length ? nonPlaceholder : rows;
        return chooseAuthoritativeCandidate(candidates as any, entry.weekStart);
      })
      .filter(Boolean) as any[];

    const realRows = bestRows.filter((row) => !((row.rawPayload as any)?.placeholder === true));
    const placeholderRows = bestRows.filter((row) => (row.rawPayload as any)?.placeholder === true);
    const present = realRows.length;
    const missing = Math.max(totalActiveAccounts - present, 0);
    const gross = bestRows.reduce((sum, row) => sum + Number(row?.grossSales ?? 0), 0);
    const totalRealPayout = realRows.reduce((sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0), 0);
    const totalPlaceholderPayout = placeholderRows.reduce((sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0), 0);
    const displayPayout = totalRealPayout > 0 ? totalRealPayout : totalPlaceholderPayout;
    const displayEnd = new Date(entry.weekEnd.getTime() - 3 * 60 * 60 * 1000);

    return {
      period: { start: entry.weekStart.toISOString(), end: entry.weekEnd.toISOString() },
      _sum: { grossSales: gross, payoutAmount: displayPayout },
      accountCount: present,
      missingCount: missing,
      label: `${formatNairobiDate(entry.weekStart)} – ${formatNairobiDate(displayEnd)}`,
      realRowCount: realRows.length,
      placeholderRowCount: placeholderRows.length,
      totalRealPayout,
      totalPlaceholderPayout,
      displayPayout,
    };
  });

  const sortedWeeks = enrichedWeeks.sort((a, b) => (a.period.start < b.period.start ? 1 : -1));

  return NextResponse.json({ weeks: sortedWeeks.slice(0, 8), totalActiveAccounts });
}
