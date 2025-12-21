import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAttendant(req, ["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const assignments = await getMarketplaceAssignmentsForUser(guard.user.id);
    const payload = assignments.assignments.map((assignment) => ({
      accountId: assignment.account.id,
      accountName: assignment.account.displayName,
      platform: assignment.account.platform,
      role: assignment.role,
      startsAt: assignment.startsAt?.toISOString() ?? null,
      endsAt: assignment.endsAt?.toISOString() ?? null,
    }));
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[attendants/marketplace-assignments] failed to load assignments:", err);
    return NextResponse.json([], { status: 500 });
  }
}
