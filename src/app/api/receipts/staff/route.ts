import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  // Allow public, read-only access to the staff list so the receipts
  // page can render a selectable staff dropdown even when unauthenticated.
  // Only return minimal, non-sensitive fields.
  let staff: any[] = [];
  try {
    staff = await prisma.user.findMany({
      where: {
        role: { in: ["ATTENDANT", "SUPERVISOR"] },
        isActive: true,
        agentProfile: { is: null },
      },
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        attendantCategory: true,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    // eslint-disable-next-line no-console
    console.warn("/api/receipts/staff: primary query failed:", msg);
    // Fall back to a simpler query (avoid attendantCategory ordering/selection)
    try {
      staff = await prisma.user.findMany({
        where: {
          role: { in: ["ATTENDANT", "SUPERVISOR"] },
          isActive: true,
          agentProfile: { is: null },
        },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, email: true },
      });
    } catch (err2: any) {
      const msg2 = String(err2?.message ?? err2);
      // eslint-disable-next-line no-console
      console.warn("/api/receipts/staff: fallback query failed:", msg2);
      // If even the fallback fails (e.g., no DB), return empty list instead of 500
      staff = [];
    }
  }

  return NextResponse.json(
    staff.map((member) => ({
      id: member.id,
      name: member.name || member.email || "Unnamed",
      email: member.email,
      attendantCategory: member.attendantCategory,
    }))
  );
}
