import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user?.role ?? "") !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing attendant ID" }, { status: 400 });
    const body = await request.json();
    const action = body?.action;
    if (!action || !["activate", "deactivate"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const isActive = action === "activate";
    // Use Prisma's checked update rather than a raw update that can silently
    // affect zero rows. This makes the status returned to the browser the
    // exact status persisted for the selected attendant.
    const attendant = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        select: { id: true, isActive: true },
      });

      if (!isActive) {
        // Inactive staff must be impossible to select as a live voice target.
        // Route construction also checks User.isActive, while these updates
        // immediately remove any saved voice-desk routing state.
        await Promise.all([
          tx.voiceAgentRoutingPreference.upsert({
            where: { userId: id },
            create: { userId: id, routingEnabled: false, allowAfterHoursCalls: false },
            update: { routingEnabled: false, allowAfterHoursCalls: false },
          }),
          tx.voiceAgentPresence.updateMany({
            where: { userId: id },
            data: { status: "OFFLINE", currentCallId: null },
          }),
          tx.voiceRoutingConfig.updateMany({
            where: { overflowUserId: id },
            data: { overflowUserId: null, overflowPhone: null },
          }),
        ]);
      }

      return updated;
    });
    return NextResponse.json(attendant);
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user?.role ?? "") !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing attendant ID" }, { status: 400 });
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
