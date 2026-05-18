import { NextRequest, NextResponse } from "next/server";
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

  let payouts: Awaited<ReturnType<typeof prisma.agentPayout.findMany>> = [];
  try {
    payouts = await prisma.agentPayout.findMany({
      where: { agentId: agentSession.userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isAgentSalesSchemaError(error)) throw error;
  }
  return NextResponse.json({ payouts });
}

export async function POST(req: NextRequest) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const amount = Number(body?.amount ?? 0);
  const method = String(body?.method || "").trim() || null;
  const phone = String(body?.phone || "").trim() || null;
  const reference = String(body?.reference || "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A valid payout amount is required." }, { status: 400 });
  }

  let commissions: Array<{ commissionAmt: number; status: string }> = [];
  let payouts: Array<{ amount: number; status: string }> = [];
  try {
    [commissions, payouts] = await Promise.all([
      prisma.agentCommission.findMany({
        where: { agentId: agentSession.userId },
        select: { commissionAmt: true, status: true },
      }),
      prisma.agentPayout.findMany({
        where: { agentId: agentSession.userId },
        select: { amount: true, status: true },
      }),
    ]);
  } catch (error) {
    if (isAgentSalesSchemaError(error)) {
      return NextResponse.json(
        {
          error:
            "Agent sales database setup is incomplete. Apply scripts/sql/20260515_agent_sales_workflow.sql in Neon, then redeploy.",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  const eligibleCommission = commissions
    .filter((row) => !["cancelled"].includes(String(row.status).toLowerCase()))
    .reduce((sum, row) => sum + Number(row.commissionAmt ?? 0), 0);
  const reservedPayouts = payouts
    .filter((row) => !["rejected", "cancelled"].includes(String(row.status).toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const available = Math.max(0, eligibleCommission - reservedPayouts);

  if (amount > available) {
    return NextResponse.json({ error: `Requested amount exceeds available withdrawal balance (${available}).` }, { status: 400 });
  }

  const payout = await prisma.agentPayout.create({
    data: {
      agentId: agentSession.userId,
      amount,
      method,
      phone,
      reference,
      status: "pending",
    },
  });

  await prisma.agentActivityLog.create({
    data: {
      agentId: agentSession.userId,
      action: "payout_requested",
      description: `Requested payout of ${amount}`,
    },
  });
  try {
    await prisma.agentAuditLog.create({
      data: {
        actorUserId: agentSession.userId,
        targetAgentId: agentSession.userId,
        payoutId: payout.id,
        eventType: "payout_requested",
        summary: `Agent ${agentSession.userId} requested payout ${payout.id}.`,
        metadata: {
          amount,
          method,
          phone,
          reference,
          available,
        },
      },
    });
  } catch {
    // enterprise tables may not exist until the manual SQL patch is applied
  }

  return NextResponse.json({ ok: true, payout });
}
