import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import {
  buildTechnicalPermissionHints,
  isTechnicalTeamCategory,
  normalizeTechnicalProfileInput,
} from "@/lib/technicalTeam";

function getTargetId(request: Request) {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const technicalIndex = parts.findIndex((part) => part === "technical-team");
  return technicalIndex >= 0 ? parts[technicalIndex + 1] || "" : "";
}

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const userId = getTargetId(request);
  if (!userId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      attendantCategory: true,
      phone: true,
      technicalProfile: true,
    },
  });

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    profile: user.technicalProfile,
    phone: user.phone ?? null,
    category: user.attendantCategory ?? null,
    permissionHints: buildTechnicalPermissionHints(user.technicalProfile?.teamRole),
    isTechnicalTeam: isTechnicalTeamCategory(user.attendantCategory),
  });
}

export async function PUT(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const userId = getTargetId(request);
  if (!userId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const normalized = normalizeTechnicalProfileInput(body);
  if (!normalized.ok) {
    return NextResponse.json({ error: "invalid_profile", issues: normalized.error }, { status: 400 });
  }

  const saved = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, attendantCategory: true },
    });

    if (!user) throw new Error("not_found");

    const profile = await tx.technicalProfile.upsert({
      where: { userId },
      update: normalized.data,
      create: {
        userId,
        ...normalized.data,
      },
    });

    return {
      profile,
      isTechnicalTeam: isTechnicalTeamCategory(user.attendantCategory),
    };
  }).catch((error) => {
    if (error instanceof Error && error.message === "not_found") return null;
    throw error;
  });

  if (!saved) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    profile: saved.profile,
    isTechnicalTeam: saved.isTechnicalTeam,
    permissionHints: buildTechnicalPermissionHints(saved.profile.teamRole),
  });
}
