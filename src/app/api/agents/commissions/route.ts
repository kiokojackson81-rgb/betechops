import { NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

function isAgentSalesSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; column?: unknown; modelName?: unknown } | null;
  };
  const code = String(candidate.code ?? "");
  if (!["P2021", "P2022"].includes(code)) return false;
  const haystack = [
    String(candidate.meta?.table ?? ""),
    String(candidate.meta?.column ?? ""),
    String(candidate.meta?.modelName ?? ""),
    String(candidate.message ?? ""),
  ].join(" ");
  return ["AgentSale", "AgentCommission", "sourceType", "sourceId", "saleAmount", "commissionPct", "commissionAmt"].some(
    (token) => haystack.includes(token),
  );
}

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let commissions: Awaited<ReturnType<typeof prisma.agentCommission.findMany>> = [];
  try {
    commissions = await prisma.agentCommission.findMany({
      where: { agentId: agentSession.userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isAgentSalesSchemaError(error)) throw error;
  }

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
