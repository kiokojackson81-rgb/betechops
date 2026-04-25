import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  if (!identity.resolvedUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.cashAdvanceRequest.findMany({
    where: { userId: identity.resolvedUserId },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(
    composeIdentityResponse(identity, {
      rows,
      pendingCount: rows.filter((row) => row.status === "PENDING").length,
      approvedCount: rows.filter((row) => row.status === "APPROVED").length,
    }),
  );
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const actorId = identity.actorId ?? null;
  const userId = identity.resolvedUserId;
  if (!actorId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    requestedAmount?: number;
    reason?: string;
  } | null;

  const requestedAmount = Math.trunc(Number(body?.requestedAmount ?? 0));
  const reason = String(body?.reason ?? "").trim();

  if (requestedAmount <= 0 || !reason) {
    return NextResponse.json({ error: "requestedAmount and reason are required" }, { status: 400 });
  }

  const existingPending = await prisma.cashAdvanceRequest.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json({ error: "Resolve the existing pending request before submitting another one" }, { status: 400 });
  }

  try {
    const created = await prisma.cashAdvanceRequest.create({
      data: {
        userId,
        requestedAmount,
        reason,
      },
    });

    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "CashAdvanceRequest",
        entityId: created.id,
        action: "CREATE",
        after: created as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create cash advance request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
