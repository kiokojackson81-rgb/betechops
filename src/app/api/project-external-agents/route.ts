import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { DEFAULT_PROJECT_EXTERNAL_AGENTS, normalizeProjectHandlerPhone } from "@/lib/projectHandlers";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  whatsappNumber: z.string().trim().min(7).max(30),
});

export async function GET() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const existing = await prisma.projectExternalAgent.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(existing);
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid external agent payload" }, { status: 400 });
  }

  const normalizedPhone = normalizeProjectHandlerPhone(parsed.data.whatsappNumber);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid external agent WhatsApp number" }, { status: 400 });
  }

  const agent = await prisma.projectExternalAgent.create({
    data: {
      name: parsed.data.name,
      whatsappNumber: normalizedPhone,
    },
  });

  return NextResponse.json(agent, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing external agent id" }, { status: 400 });
  }

  await prisma.projectExternalAgent.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const seeded = await prisma.$transaction(async (tx) => {
    const rows: Array<{
      id: string;
      name: string;
      whatsappNumber: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    for (const entry of DEFAULT_PROJECT_EXTERNAL_AGENTS) {
      const existing = await tx.projectExternalAgent.findFirst({
        where: { name: entry.name, whatsappNumber: entry.whatsappNumber },
      });
      rows.push(
        existing ??
          (await tx.projectExternalAgent.create({
            data: {
              name: entry.name,
              whatsappNumber: entry.whatsappNumber,
            },
          })),
      );
    }
    return rows;
  });

  return NextResponse.json(seeded);
}
