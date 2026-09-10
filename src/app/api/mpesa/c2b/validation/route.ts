import { NextResponse } from "next/server";
import { canAcceptC2bReference, isExpectedC2bPaybill } from "@/lib/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  if (!isExpectedC2bPaybill(payload)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid Paybill" });
  }
  const reference = String((payload as Record<string, unknown>).BillRefNumber || "").trim();
  // Do not reject an unknown reference: Safaricom will still send the
  // confirmation and it is retained as UNMATCHED for reconciliation.
  await canAcceptC2bReference(reference).catch((error) => console.error("[mpesa] C2B validation lookup failed", error));
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
