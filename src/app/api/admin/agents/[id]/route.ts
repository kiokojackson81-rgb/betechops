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
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
  }

  const profile = await prisma.agentProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const actorUserId = (adminSession.session.user as { id?: string } | undefined)?.id ?? null;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.agentAuditLog.create({
        data: {
          actorUserId,
          targetAgentId: profile.userId,
          eventType: "agent_deleted",
          summary: `Agent ${profile.userId} deleted from admin.`,
          metadata: {
            profileId: profile.id,
            email: profile.user.email,
            name: profile.user.name,
          },
        },
      });
    } catch {
      // best-effort audit
    }

    await tx.user.delete({
      where: { id: profile.userId },
    });
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
    },
  });
}
