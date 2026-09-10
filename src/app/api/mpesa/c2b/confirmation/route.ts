import { NextResponse } from "next/server";
import { handleC2bConfirmation, isExpectedC2bPaybill } from "@/lib/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!isExpectedC2bPaybill(payload)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid Paybill" });
  }
  try {
    await handleC2bConfirmation(payload);
  } catch (error) {
    console.error("[mpesa] C2B confirmation processing failed", error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unable to process confirmation" }, { status: 500 });
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
