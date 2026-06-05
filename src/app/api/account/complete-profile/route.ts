import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const emailRaw = String(body?.email || "").trim().toLowerCase();
  const county = String(body?.county || "").trim();
  const town = String(body?.town || "").trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }

  if (emailRaw) {
    const existing = await prisma.user.findFirst({
      where: {
        email: emailRaw,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: "That email address is already in use." }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email: emailRaw || null,
      county: county || null,
      town: town || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      county: true,
      town: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
