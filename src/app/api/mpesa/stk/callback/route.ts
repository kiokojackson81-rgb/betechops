import { NextResponse } from "next/server";
import { handleStkCallback } from "@/lib/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  try {
    await handleStkCallback(payload);
  } catch (error) {
    // Safaricom retries delivery. Return an error for a transient processing
    // failure, while never exposing payment data in the response.
    console.error("[mpesa] STK callback processing failed", error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unable to process callback" }, { status: 500 });
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
