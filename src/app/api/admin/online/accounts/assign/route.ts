import { NextResponse } from "next/server";
import type { MarketplaceAssignmentRole } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AssignPayload = {
  accountId: string;
  attendantId: string;
  role: MarketplaceAssignmentRole;
  endsAt?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  let payload: AssignPayload | null = null;
  try {
    payload = (await req.json()) as AssignPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.accountId || !payload.attendantId || !payload.role) {
    return NextResponse.json({ error: "accountId, attendantId and role are required" }, { status: 400 });
  }

  const assignment = await prisma.marketplaceAccountAssignment.upsert({
    where: {
      accountId_attendantId_role: {
        accountId: payload.accountId,
        attendantId: payload.attendantId,
        role: payload.role,
      },
    },
    create: {
      accountId: payload.accountId,
      attendantId: payload.attendantId,
      role: payload.role,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    },
    update: {
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    },
  });

  return NextResponse.json({ assignment });
}
