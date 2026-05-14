import { NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissions = await prisma.agentCommission.findMany({
    where: { agentId: agentSession.userId },
    orderBy: { createdAt: "desc" },
  });

  const summary = commissions.reduce(
    (acc, row) => {
      acc.totalSales += Number(row.saleAmount ?? 0);
      acc.totalCommission += Number(row.commissionAmt ?? 0);
      if (String(row.status).toLowerCase() === "paid") acc.paidCommission += Number(row.commissionAmt ?? 0);
      else acc.pendingCommission += Number(row.commissionAmt ?? 0);
      return acc;
    },
    { totalSales: 0, totalCommission: 0, paidCommission: 0, pendingCommission: 0 },
  );

  return NextResponse.json({ summary, commissions });
}
