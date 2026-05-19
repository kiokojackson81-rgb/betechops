import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(["pending", "approved", "paid", "rejected", "held"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || "").trim().toLowerCase();
  const reference = String(body?.reference || "").trim() || null;
  const reason = String(body?.reason || "").trim() || null;
  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;

  if (!id || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "A valid payout id and status are required." }, { status: 400 });
  }
  if (status === "paid" && !reference) {
    return NextResponse.json({ error: "M-Pesa reference code is required before marking this payout as paid." }, { status: 400 });
  }
  if (status === "rejected" && !reason) {
    return NextResponse.json({ error: "Please provide a reason for rejecting this payout request." }, { status: 400 });
  }

  const existingPayout = await prisma.agentPayout.findUnique({
    where: { id },
    select: { id: true, agentId: true, amount: true },
  });

  if (!existingPayout) {
    return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
  }

  let payout;

  if (status === "paid") {
    payout = await prisma.$transaction(async (tx) => {
      const updatedPayout = await tx.agentPayout.update({
        where: { id },
        data: {
          status,
          ...(reference !== null ? { reference } : {}),
        },
      });

      const commissions = await tx.agentCommission.findMany({
        where: {
          agentId: updatedPayout.agentId,
          status: "approved",
        },
        orderBy: { createdAt: "asc" },
      });

      let remaining = Number(updatedPayout.amount ?? 0);
      for (const commission of commissions) {
        const amount = Number(commission.commissionAmt ?? 0);
        if (remaining <= 0) break;
        if (amount <= remaining + 0.0001) {
          await tx.agentCommission.update({
            where: { id: commission.id },
            data: { status: "paid" },
          });
          remaining -= amount;
        }
      }

      return updatedPayout;
    });
  } else {
    payout = await prisma.agentPayout.update({
      where: { id },
      data: {
        status,
        ...(reference !== null ? { reference } : {}),
      },
    });
  }

  try {
    await prisma.agentActivityLog.create({
      data: {
        agentId: payout.agentId,
        action: `payout_${status}`,
        description:
          status === "rejected" && reason
            ? `Agent payout ${payout.id} was rejected by admin. Reason: ${reason}`
            : status === "paid" && reference
              ? `Agent payout ${payout.id} was marked paid by admin. M-Pesa reference: ${reference}`
              : `Agent payout ${payout.id} moved to ${status} by admin.`,
      },
    });
  } catch {
    // activity logging should not block payout state transitions
  }

  try {
    await prisma.agentAuditLog.create({
      data: {
        actorUserId,
        targetAgentId: payout.agentId,
        payoutId: payout.id,
        eventType: `payout_${status}`,
        summary: `Payout ${payout.id} moved to ${status}.`,
        metadata: {
          status,
          amount: payout.amount,
          reference,
          reason,
        },
      },
    });
  } catch {
    // enterprise tables may not exist until the manual SQL patch is applied
  }

  return NextResponse.json({ ok: true, payout });
}
