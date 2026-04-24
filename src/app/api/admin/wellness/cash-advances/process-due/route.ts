import { NextResponse } from "next/server";
import { getActorId, requireRole } from "@/lib/api";
import { applyDueCashAdvanceInstallments } from "@/lib/wellness";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { asOf?: string } | null;
  const asOf = body?.asOf ? new Date(body.asOf) : new Date();

  try {
    const result = await applyDueCashAdvanceInstallments({ actorId, asOf });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process installments";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
