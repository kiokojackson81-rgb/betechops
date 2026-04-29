import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  // Allow public, read-only access to the staff list so the receipts
  // page can render a selectable staff dropdown even when unauthenticated.
  // Only return minimal, non-sensitive fields.
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
