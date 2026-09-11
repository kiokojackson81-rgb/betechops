import { NextRequest, NextResponse } from "next/server";
import { reconcileUnmatchedMpesaPayment } from "@/lib/mpesa";
import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const targetKind = body.targetKind === "ORDER" || body.targetKind === "WEBSITE_ORDER" ? body.targetKind : null;
  const targetId = String(body.targetId || "").trim();
  if (body.confirm !== true) return NextResponse.json({ ok: false, error: "Explicit reconciliation confirmation is required" }, { status: 400 });
  if (!targetKind || !targetId) return NextResponse.json({ ok: false, error: "Select an order before reconciling" }, { status: 400 });

  try {
    const result = await reconcileUnmatchedMpesaPayment({ paymentId: id, target: { kind: targetKind, id: targetId }, actorId: guard.userId });
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reconcile payment";
    const status = /not found|unavailable/i.test(message) ? 404 : /already|Only unmatched/i.test(message) ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
