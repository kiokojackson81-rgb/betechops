import { NextResponse } from "next/server";
import { requireAdminLikeSession } from "@/lib/agents/auth";
import { getAdminAgentSaleById } from "@/lib/agents/sales";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminLikeSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await getAdminAgentSaleById(id);
  if (!result) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}

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
    return NextResponse.json({ error: "Sale id is required." }, { status: 400 });
  }

  const sale = await prisma.agentSale.findUnique({
    where: { id },
    select: {
      id: true,
      agentId: true,
      customerName: true,
      productName: true,
      receiptId: true,
      receiptNumber: true,
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;
  const actorEmail = (adminSession.session.user as { email?: string } | undefined)?.email ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.agentCommission.deleteMany({
      where: {
        sourceType: "agent_sale",
        sourceId: sale.id,
      },
    });

    try {
      await tx.agentActivityLog.create({
        data: {
          agentId: sale.agentId,
          action: "sale_deleted",
          description: `Agent sale ${sale.id} deleted by ${actorEmail || "admin"}.`,
        },
      });
    } catch {
      // best-effort activity log
    }

    try {
      await tx.agentAuditLog.create({
        data: {
          actorUserId,
          targetAgentId: sale.agentId,
          saleId: sale.id,
          eventType: "agent_sale_deleted",
          summary: `Agent sale ${sale.id} deleted from admin.`,
          metadata: {
            customerName: sale.customerName,
            productName: sale.productName,
            receiptId: sale.receiptId,
            receiptNumber: sale.receiptNumber,
          },
        },
      });
    } catch {
      // best-effort audit
    }

    await tx.agentSale.delete({
      where: { id: sale.id },
    });
  });

  return NextResponse.json({ ok: true, deleted: sale });
}
