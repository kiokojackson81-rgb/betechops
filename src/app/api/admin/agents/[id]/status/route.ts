import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(["pending", "approved", "rejected", "suspended"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const status = String(body?.status || "").trim().toLowerCase();
  if (!id || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "A valid agent id and status are required." }, { status: 400 });
  }

  const profile = await prisma.agentProfile.update({
    where: { id },
    data: { status },
  });

  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;
  await prisma.agentActivityLog.create({
    data: {
      agentId: profile.userId,
      action: `status_${status}`,
      description: `Agent status changed to ${status} by admin`,
    },
  });
  try {
    await prisma.agentAuditLog.create({
      data: {
        actorUserId,
        targetAgentId: profile.userId,
        eventType: `agent_status_${status}`,
        summary: `Agent ${profile.userId} moved to ${status}.`,
        metadata: {
          profileId: profile.id,
          status,
        },
      },
    });
  } catch {
    // enterprise tables may not exist until the manual SQL patch is applied
  }

  return NextResponse.json({ ok: true, profile });
}
