import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { isBrendahEmail } from "@/lib/api";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const targetUserId = identity.resolvedUserId;

  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      isActive: true,
      categoryAssignments: { select: { category: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { categoryAssignments, ...rest } = user;
  const impersonated = Boolean(identity.impersonateId && identity.resolvedUserId === identity.impersonateId);
  const email = typeof rest.email === "string" ? rest.email.toLowerCase() : "";
  const supervisorPerformanceTools = email === "benjamin@betech.co.ke";
  const brendahDailyDuties = isBrendahEmail(email);
  const jenifferSpecialProgress = email === "jeniffer@betech.co.ke";
  const payload = {
    user: { ...rest, categories: categoryAssignments.map((c) => c.category) },
    impersonated,
    impersonatedBy: impersonated ? identity.actorRole ?? null : null,
    flags: {
      supervisorPerformanceTools,
      brendahDailyDuties,
      jenifferSpecialProgress,
      dutyProfile: brendahDailyDuties ? "BRENDAH_DAILY_DUTIES" : "DEFAULT_MARKETING_DUTIES",
    },
  };

  return NextResponse.json(composeIdentityResponse(meta, payload));
}
