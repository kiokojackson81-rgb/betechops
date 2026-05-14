import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { prisma } from "@/lib/prisma";

const editableFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "nationalId",
  "kraPin",
  "gender",
  "country",
  "county",
  "city",
  "address",
  "idFrontUrl",
  "idBackUrl",
  "profilePhotoUrl",
];

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.agentProfile.findUnique({
    where: { userId: agentSession.userId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, string | null | Date> = {};
  for (const field of editableFields) {
    if (field in body) {
      const value = body[field];
      data[field] = value === null || value === undefined || value === "" ? null : String(value).trim();
    }
  }
  if ("dateOfBirth" in body) {
    data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  }

  const profile = await prisma.agentProfile.update({
    where: { userId: agentSession.userId },
    data,
  });

  await prisma.agentActivityLog.create({
    data: {
      agentId: agentSession.userId,
      action: "profile_updated",
      description: "Agent updated profile details",
    },
  });

  return NextResponse.json({ ok: true, profile });
}

export async function PATCH() {
  return NextResponse.json({ error: "Use /api/admin/agents/[id]/status for admin status updates." }, { status: 405 });
}
