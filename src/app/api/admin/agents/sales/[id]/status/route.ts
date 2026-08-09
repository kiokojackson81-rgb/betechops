import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { updateAgentSaleStatus } from "@/lib/agents/sales";
import { notifyAgentSaleStatusChanged } from "@/services/agent-notifications/agent-notification.service";

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
    const user = adminSession.session.user as { email?: string; id?: string } | undefined;
    const sale = await updateAgentSaleStatus(id, body, { email: user?.email ?? null, userId: user?.id ?? null });
    const status = String(body?.status || "").trim().toLowerCase();
    if (["processing", "rejected", "cancelled"].includes(status)) {
      void notifyAgentSaleStatusChanged(sale.id, status).catch((error) => {
        console.error("[agent notify] failed to send sale status notification", {
          saleId: sale.id,
          status,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update sale status." },
      { status: 400 },
    );
  }
}
