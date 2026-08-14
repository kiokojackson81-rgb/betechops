import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildStaffAttendantWhere, STAFF_ATTENDANT_ROLES } from "@/lib/staffUsers";
import { resolveProjectStaffPhone } from "@/lib/projectHandlers";

export async function GET() {
  // Allow public, read-only access to the staff list so the receipts
  // page can render a selectable staff dropdown even when unauthenticated.
  // Only return minimal, non-sensitive fields.
  let staff: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    whatsappNumber?: string | null;
    attendantCategory?: string | null;
    technicalProfile?: { phoneNumber: string | null } | null;
  }> = [];
  try {
    staff = await prisma.user.findMany({
      where: buildStaffAttendantWhere(),
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsappNumber: true,
        attendantCategory: true,
        technicalProfile: { select: { phoneNumber: true } },
      },
    });
  } catch (err: unknown) {
    const msg = String(err);
    console.warn("/api/receipts/staff: primary query failed:", msg);
    // Fall back to a simpler query (avoid attendantCategory ordering/selection)
    try {
      staff = await prisma.user.findMany({
        where: {
          role: { in: STAFF_ATTENDANT_ROLES },
          isActive: true,
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          whatsappNumber: true,
          technicalProfile: { select: { phoneNumber: true } },
        },
      });
    } catch (err2: unknown) {
      const msg2 = String(err2);
      console.warn("/api/receipts/staff: fallback query failed:", msg2);
      // If even the fallback fails (e.g., no DB), return empty list instead of 500
      staff = [];
    }
  }

  return NextResponse.json(
    staff.map((member) => {
      const resolvedPhone = resolveProjectStaffPhone({
        name: member.name ?? member.email,
        whatsappNumber: member.whatsappNumber ?? null,
        phone: member.phone ?? null,
        technicalPhoneNumber: member.technicalProfile?.phoneNumber ?? null,
      });
      return {
        id: member.id,
        name: member.name || member.email || "Unnamed",
        email: member.email,
        phone: resolvedPhone ?? member.phone ?? null,
        whatsappNumber: resolvedPhone ?? member.whatsappNumber ?? null,
        attendantCategory: member.attendantCategory,
        technicalPhoneNumber: resolvedPhone ?? member.technicalProfile?.phoneNumber ?? null,
      };
    })
  );
}
