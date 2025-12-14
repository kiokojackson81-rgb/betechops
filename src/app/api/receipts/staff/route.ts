import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";

export async function GET(request: Request) {
  const guard = await requireAttendant(request);
  if (!guard.ok) {
    return guard.res;
  }

  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["ATTENDANT", "SUPERVISOR"] },
      isActive: true,
    },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
    },
  });

  return NextResponse.json(
    staff.map((member) => ({
      id: member.id,
      name: member.name || member.email || "Unnamed",
      email: member.email,
      attendantCategory: member.attendantCategory,
    }))
  );
}
