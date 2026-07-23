import { NextResponse } from "next/server";
import { requireAdminLikeSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminLikeSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Payout id is required." }, { status: 400 });
  }

  const payout = await prisma.agentPayout.findUnique({
    where: { id },
    select: {
      id: true,
      agentId: true,
      amount: true,
      method: true,
      phone: true,
      reference: true,
      status: true,
      createdAt: true,
    },
  });

  if (!payout) {
    return NextResponse.json({ error: "Payout not found." }, { status: 404 });
  }

  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;
  const actorEmail = (adminSession.session.user as { email?: string } | undefined)?.email ?? null;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.agentActivityLog.create({
        data: {
          agentId: payout.agentId,
          action: "payout_deleted",
          description: `Payout ${payout.id} deleted by ${actorEmail || "admin"}.`,
        },
      });
    } catch {
      // best-effort activity log
    }

    try {
      await tx.agentAuditLog.create({
        data: {
          actorUserId,
          targetAgentId: payout.agentId,
          payoutId: payout.id,
          eventType: "agent_payout_deleted",
          summary: `Agent payout ${payout.id} deleted from admin.`,
          metadata: {
            amount: payout.amount,
            method: payout.method,
            phone: payout.phone,
            reference: payout.reference,
            status: payout.status,
            createdAt: payout.createdAt.toISOString(),
          },
        },
      });
    } catch {
      // best-effort audit
    }

    await tx.agentPayout.delete({
      where: { id: payout.id },
    });
  });

  return NextResponse.json({ ok: true, deleted: payout });
}
