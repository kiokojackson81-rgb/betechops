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
  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;

  if (!id || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "A valid payout id and status are required." }, { status: 400 });
  }

  const payout = await prisma.$transaction(async (tx) => {
    const updatedPayout = await tx.agentPayout.update({
      where: { id },
      data: {
        status,
        ...(reference !== null ? { reference } : {}),
      },
    });

    if (status === "paid") {
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
    }

    await tx.agentActivityLog.create({
      data: {
        agentId: updatedPayout.agentId,
        action: `payout_${status}`,
        description: `Agent payout ${updatedPayout.id} moved to ${status} by admin.`,
      },
    });
    try {
      await tx.agentAuditLog.create({
        data: {
          actorUserId,
          targetAgentId: updatedPayout.agentId,
          payoutId: updatedPayout.id,
          eventType: `payout_${status}`,
          summary: `Payout ${updatedPayout.id} moved to ${status}.`,
          metadata: {
            status,
            amount: updatedPayout.amount,
            reference,
          },
        },
      });
    } catch {
      // enterprise tables may not exist until the manual SQL patch is applied
    }

    return updatedPayout;
  });

  return NextResponse.json({ ok: true, payout });
}
