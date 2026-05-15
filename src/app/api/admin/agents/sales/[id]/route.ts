import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { getAdminAgentSaleById } from "@/lib/agents/sales";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await getAdminAgentSaleById(id);
  if (!result) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
