import { NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { getAgentSaleById } from "@/lib/agents/sales";

function ensureApprovedAgent(agentStatus: string | null) {
  return String(agentStatus || "").toLowerCase() === "approved";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ensureApprovedAgent(agentSession.agentStatus)) {
    return NextResponse.json({ error: "Only approved agents can access sales." }, { status: 403 });
  }

  const { id } = await params;
  const sale = await getAgentSaleById(agentSession.userId, id);
  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  return NextResponse.json({ sale });
}
