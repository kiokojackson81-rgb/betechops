import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum(["SUBMITTED", "REVIEWING", "SHORTLISTED", "VIDEO_REQUESTED", "INTERVIEWED", "NOT_SELECTED", "HIRED"]),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!access.ok) return access.res;

  const { id } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid application status." }, { status: 400 });

  const updated = await prisma.careerApplication.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, updatedAt: true },
  }).catch(() => null);
  if (!updated) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  return NextResponse.json({ ok: true, application: updated });
}