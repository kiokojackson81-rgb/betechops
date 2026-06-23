import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { updateAgentSaleStatus } from "@/lib/agents/sales";

export const dynamic = "force-dynamic";

const ALLOWED_DESK_GROUPS = ["ADMIN", "DIRECT_SALES_OPS", "MARKETING_OPS"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAttendant(request, [...ALLOWED_DESK_GROUPS]);
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const sale = await updateAgentSaleStatus(id, body, {
      userId: guard.user.id,
      email: (guard.session.user as { email?: string | null } | undefined)?.email ?? null,
    });
    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update agent order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
