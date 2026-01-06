import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeWeeklySummary } from "@/lib/jobs/recomputeWeeklySummaries";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const { assignments } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!assignments.length) {
    return NextResponse.json({ accounts: [] });
  }

  const payload = await Promise.all(
    assignments.map(async (assignment) => {
      // Use grouped aggregates to avoid duplicate rows skewing totals
      const weekAggs = (await recomputeWeeklySummary(new Date(0), new Date())).filter((a) => a.accountId === assignment.accountId);
      // sort by weekStart desc and take 4
      weekAggs.sort((x, y) => y.weekStart.getTime() - x.weekStart.getTime());
      const weeks = weekAggs.slice(0, 4);
      const total4Weeks = weeks.reduce((sum, w) => sum + Number(w.totalGross ?? 0), 0);

      return {
        accountId: assignment.accountId,
        accountName: assignment.account.displayName,
        platform: assignment.account.platform,
        weeks: weeks.map((week) => ({
          id: null,
          statementNumber: null,
          weekStart: week.weekStart.toISOString(),
          weekEnd: week.weekEnd.toISOString(),
          grossSales: Number(week.totalGross ?? 0),
          payoutAmount: Number(week.totalPayout ?? 0),
          currency: 'LOCAL',
          isPaid: true,
        })),
        total4Weeks,
      };
    }),
  );

  return NextResponse.json({ accounts: payload });
}
