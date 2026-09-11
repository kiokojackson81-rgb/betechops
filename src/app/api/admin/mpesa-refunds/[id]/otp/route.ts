import { NextRequest, NextResponse } from "next/server";
import { requireMpesaRefundAdmin, sendMpesaRefundOtp } from "@/lib/mpesaRefunds";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    await sendMpesaRefundOtp({ refundId: (await context.params).id, actorId: guard.userId });
    return NextResponse.json({ ok: true, message: "Approval code sent to your authorized mobile number" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to send refund approval code" }, { status: 400 });
  }
}
