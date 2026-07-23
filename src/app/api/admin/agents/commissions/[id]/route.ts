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
    return NextResponse.json({ error: "Commission id is required." }, { status: 400 });
  }

  const commission = await prisma.agentCommission.findUnique({
    where: { id },
    select: {
      id: true,
      agentId: true,
      sourceType: true,
      sourceId: true,
      orderNumber: true,
      saleAmount: true,
      commissionAmt: true,
      status: true,
    },
  });

  if (!commission) {
    return NextResponse.json({ error: "Commission not found." }, { status: 404 });
  }

  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;
  const actorEmail = (adminSession.session.user as { email?: string } | undefined)?.email ?? null;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.agentActivityLog.create({
        data: {
          agentId: commission.agentId,
          action: "commission_deleted",
          description: `Commission ${commission.id} deleted by ${actorEmail || "admin"}.`,
        },
      });
    } catch {
      // best-effort activity log
    }

    try {
      await tx.agentAuditLog.create({
        data: {
          actorUserId,
          targetAgentId: commission.agentId,
          eventType: "agent_commission_deleted",
          summary: `Agent commission ${commission.id} deleted from admin.`,
          metadata: commission,
        },
      });
    } catch {
      // best-effort audit
    }

    await tx.agentCommission.delete({
      where: { id: commission.id },
    });
  });

  return NextResponse.json({ ok: true, deleted: commission });
}
