import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
      const weeks = await prisma.marketplacePayoutWeek.findMany({
        where: { accountId: assignment.accountId },
        orderBy: { weekEnd: "desc" },
        take: 4,
      });
      const total4Weeks = weeks.reduce((sum: number, week: any) => sum + Number(week.grossSales ?? 0), 0);

      return {
        accountId: assignment.accountId,
        accountName: assignment.account.displayName,
        platform: assignment.account.platform,
        weeks: weeks.map((week: any) => ({
          id: week.id,
          statementNumber: week.statementNumber,
          weekStart: week.weekStart.toISOString(),
          weekEnd: week.weekEnd.toISOString(),
          grossSales: Number(week.grossSales ?? 0),
          payoutAmount: Number(week.payoutAmount ?? 0),
          currency: week.currency,
          isPaid: week.isPaid,
        })),
        total4Weeks,
      };
    }),
  );

  return NextResponse.json({ accounts: payload });
}
