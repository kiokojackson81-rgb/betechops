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

  if (!id || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "A valid payout id and status are required." }, { status: 400 });
  }

  const payout = await prisma.agentPayout.update({
    where: { id },
    data: {
      status,
      ...(reference !== null ? { reference } : {}),
    },
  });

  await prisma.agentActivityLog.create({
    data: {
      agentId: payout.agentId,
      action: `payout_${status}`,
      description: `Agent payout ${payout.id} moved to ${status} by admin.`,
    },
  });

  return NextResponse.json({ ok: true, payout });
}
