import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/agents/auth";
import { completeAgentSale } from "@/lib/agents/sales";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const user = adminSession.session.user as { email?: string; id?: string } | undefined;
    const sale = await completeAgentSale(id, { email: user?.email ?? null, userId: user?.id ?? null });
    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete sale." },
      { status: 400 },
    );
  }
}
