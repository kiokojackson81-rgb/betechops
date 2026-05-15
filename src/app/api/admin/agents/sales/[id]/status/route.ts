import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { updateAgentSaleStatus } from "@/lib/agents/sales";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const email = (adminSession.session.user as { email?: string } | undefined)?.email ?? null;
    const sale = await updateAgentSaleStatus(id, body, email);
    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update sale status." },
      { status: 400 },
    );
  }
}
