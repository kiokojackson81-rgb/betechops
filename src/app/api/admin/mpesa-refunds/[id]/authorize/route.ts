import { NextRequest, NextResponse } from "next/server";
import { authorizeMpesaRefund, requireMpesaRefundAdmin } from "@/lib/mpesaRefunds";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const body = await request.json().catch(() => ({}));
  try {
    await authorizeMpesaRefund({ refundId: (await context.params).id, code: String(body.code || ""), actorId: guard.userId });
    return NextResponse.json({ ok: true, status: "AUTHORIZED" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to authorize refund" }, { status: 400 });
  }
}
