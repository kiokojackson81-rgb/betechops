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

  const advances = await prisma.cashAdvance.findMany({
    where: { userId: identity.resolvedUserId },
    include: {
      installments: {
        orderBy: [{ dueDate: "asc" }],
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(
    composeIdentityResponse(identity, {
      rows: advances,
      outstandingBalance: advances.reduce((sum, item) => sum + Number(item.remainingBalance ?? 0), 0),
    }),
  );
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? identity.actorId ?? null;
  const userId = identity.resolvedUserId;
  if (!userId || !actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    requestedAmount?: number;
    reason?: string;
    repaymentPeriod?: number;
  } | null;

  const requestedAmount = Math.trunc(Number(body?.requestedAmount ?? 0));
  const repaymentPeriod = Math.trunc(Number(body?.repaymentPeriod ?? 0));
  const reason = String(body?.reason ?? "").trim();

  if (requestedAmount <= 0 || !reason) {
    return NextResponse.json({ error: "requestedAmount and reason are required" }, { status: 400 });
  }

  try {
    const created = await prisma.cashAdvance.create({
      data: {
        userId,
        requestedAmount,
        reason,
        repaymentPeriod: repaymentPeriod > 0 ? repaymentPeriod : null,
      },
      include: {
        installments: true,
      },
    });

    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "CashAdvance",
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
