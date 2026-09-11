import { NextRequest, NextResponse } from "next/server";
import { executeAuthorizedMpesaRefund, requireMpesaRefundAdmin } from "@/lib/mpesaRefunds";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    await executeAuthorizedMpesaRefund({ refundId: (await context.params).id, actorId: guard.userId });
    return NextResponse.json({ ok: true, status: "PROCESSING", message: "Safaricom accepted the reversal request. Accounting will change only after its final callback." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to submit refund" }, { status: 400 });
  }
}
