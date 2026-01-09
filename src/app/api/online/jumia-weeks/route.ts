import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeWeeklySummary } from "../../../../lib/jobs/recomputeWeeklySummaries";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";
import { chooseAuthoritativeCandidate, Candidate, ensureCanonicalWeekStart } from "@/lib/payoutDeduper";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const { assignments } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!assignments.length) {
    return NextResponse.json({ accounts: [] });
  }

  const weekStarts = [];
  const today = new Date();
  let cursor = ensureCanonicalWeekStart(today);
  for (let i = 0; i < 4; i += 1) {
    weekStarts.push(new Date(cursor));
    cursor = new Date(cursor.getTime() - 7 * 24 * 3600 * 1000);
  }
  const oldestStart = weekStarts[weekStarts.length - 1];
  const newestEndExclusive = new Date(weekStarts[0].getTime() + 7 * 24 * 3600 * 1000);

  const payload = await Promise.all(
    assignments.map(async (assignment) => {
      const rows = await prisma.marketplacePayoutWeek.findMany({
        where: {
          accountId: assignment.accountId,
          weekStart: { gte: oldestStart },
          weekEnd: { lte: newestEndExclusive },
        },
        orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
      });

      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const canonicalStart = ensureCanonicalWeekStart(new Date(row.weekStart));
        const key = canonicalStart.toISOString();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
      }

      const weeks = weekStarts.map((start) => {
        const key = start.toISOString();
        const items = grouped.get(key) ?? [];
        const endInclusive = new Date(start.getTime() + 7 * 24 * 3600 * 1000 - 1);

        if (!items.length) {
          return {
            id: null,
            statementNumber: null,
            weekStart: start.toISOString(),
            weekEnd: endInclusive.toISOString(),
            grossSales: 0,
            payoutAmount: 0,
            currency: "KES",
            isPaid: false,
            placeholder: true,
          };
        }

        const candidates: Candidate[] = items.map((r) => ({
          id: r.id,
          weekStart: new Date(r.weekStart),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(0),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
          statementNumber: r.statementNumber ?? null,
          payoutAmount: r.payoutAmount ?? null,
          grossSales: r.grossSales ?? null,
          rawPayload: r.rawPayload,
          isPaid: r.isPaid ?? false,
        }));

        const keeper = chooseAuthoritativeCandidate(candidates, start);
        const payout = Number((keeper?.payoutAmount as any) ?? 0);
        const gross = Number((keeper?.grossSales as any) ?? payout);

        return {
          id: keeper?.id ?? null,
          statementNumber: keeper?.statementNumber ?? null,
          weekStart: start.toISOString(),
          weekEnd: endInclusive.toISOString(),
          grossSales: gross,
          payoutAmount: payout,
          currency: "KES",
          isPaid: !!keeper?.isPaid,
          placeholder: Boolean((keeper?.rawPayload as any)?.placeholder === true),
        };
      });

      const total4Weeks = weeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);

      return {
        accountId: assignment.accountId,
        accountName: assignment.account.displayName,
        platform: assignment.account.platform,
        weeks,
        total4Weeks,
      };
    }),
  );

  return NextResponse.json({ accounts: payload });
}
