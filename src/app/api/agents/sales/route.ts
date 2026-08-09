import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { createAgentSale, getAgentSales } from "@/lib/agents/sales";
import { notifyAgentSaleSubmitted } from "@/services/agent-notifications/agent-notification.service";

function ensureApprovedAgent(agentStatus: string | null) {
  return String(agentStatus || "").toLowerCase() === "approved";
}

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ensureApprovedAgent(agentSession.agentStatus)) {
    return NextResponse.json({ error: "Only approved agents can access sales." }, { status: 403 });
  }

  const sales = await getAgentSales(agentSession.userId);
  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ensureApprovedAgent(agentSession.agentStatus)) {
    return NextResponse.json({ error: "Only approved agents can submit sales." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const sale = await createAgentSale(agentSession.userId, body);
    void notifyAgentSaleSubmitted(sale.id).catch((error) => {
      console.error("[agent notify] failed to send sale submitted notification", {
        saleId: sale.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return NextResponse.json({
      ok: true,
      sale,
      message:
        "Sale submitted successfully. Potential commission will be unlocked after customer pays fully and order is delivered.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit sale." },
      { status: 400 },
    );
  }
}
