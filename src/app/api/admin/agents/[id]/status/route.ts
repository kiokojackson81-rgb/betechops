import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";
import { notifyAgentStatusChanged } from "@/services/agent-notifications/agent-notification.service";

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

  const existingProfile = await prisma.agentProfile.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });
  if (!existingProfile) {
    return NextResponse.json({ error: "Agent profile not found." }, { status: 404 });
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

  if (String(existingProfile.status || "").toLowerCase() !== status) {
    void notifyAgentStatusChanged(profile.id, status).catch((error) => {
      console.error("[agent notify] failed to send agent status notification", {
        profileId: profile.id,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return NextResponse.json({ ok: true, profile });
}
