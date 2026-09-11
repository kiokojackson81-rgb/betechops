import { NextResponse } from "next/server";
import { z } from "zod";
import { getStkPaymentStatus } from "@/lib/mpesa";

export const dynamic = "force-dynamic";

const query = z.string().trim().min(8).max(200);

// CheckoutRequestID is a high-entropy capability returned only to the payer
// after initiation. This intentionally returns no callback payload or customer
// details, so it is safe for short-lived browser polling.
export async function GET(request: Request) {
  const checkoutRequestId = query.safeParse(new URL(request.url).searchParams.get("checkoutRequestId"));
  if (!checkoutRequestId.success) return NextResponse.json({ error: "A valid checkout request ID is required." }, { status: 400 });
  const payment = await getStkPaymentStatus(checkoutRequestId.data);
  if (!payment) return NextResponse.json({ error: "Payment request not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, payment }, { headers: { "Cache-Control": "no-store" } });
}
