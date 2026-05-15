import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { getAdminAgentSales } from "@/lib/agents/sales";

export async function GET(req: NextRequest) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const sales = await getAdminAgentSales({
    q: url.searchParams.get("q") || undefined,
    status: url.searchParams.get("status") || undefined,
    agentId: url.searchParams.get("agentId") || undefined,
    paymentType: url.searchParams.get("paymentType") || undefined,
    start: url.searchParams.get("start") || undefined,
    end: url.searchParams.get("end") || undefined,
  });

  return NextResponse.json({ sales });
}
