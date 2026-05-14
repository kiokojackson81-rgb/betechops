import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = await prisma.agentPayout.findMany({
    where: { agentId: agentSession.userId },
    orderBy: { createdAt: "desc" },
  });
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

  const [commissions, payouts] = await Promise.all([
    prisma.agentCommission.findMany({
      where: { agentId: agentSession.userId },
      select: { commissionAmt: true, status: true },
    }),
    prisma.agentPayout.findMany({
      where: { agentId: agentSession.userId },
      select: { amount: true, status: true },
    }),
  ]);

  const paidCommission = commissions
    .filter((row) => String(row.status).toLowerCase() === "paid")
    .reduce((sum, row) => sum + Number(row.commissionAmt ?? 0), 0);
  const reservedPayouts = payouts
    .filter((row) => !["rejected", "cancelled"].includes(String(row.status).toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const available = paidCommission - reservedPayouts;

  if (amount > available) {
    return NextResponse.json({ error: `Requested amount exceeds available paid commission balance (${available}).` }, { status: 400 });
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

  return NextResponse.json({ ok: true, payout });
}
