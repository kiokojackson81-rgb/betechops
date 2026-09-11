import { NextRequest, NextResponse } from "next/server";
import { handleMpesaRefundResult } from "@/lib/mpesaRefunds";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (payload) await handleMpesaRefundResult(payload).catch((error) => console.error("[mpesa] refund result callback failed", error));
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
