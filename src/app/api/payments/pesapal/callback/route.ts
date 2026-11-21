import { NextRequest, NextResponse } from "next/server";
import { settlePesapalPayment } from "@/lib/pesapal";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const trackingId = url.searchParams.get("OrderTrackingId") || "";
  const merchantReference = url.searchParams.get("OrderMerchantReference") || "";
  try {
    const result = await settlePesapalPayment({ trackingId, merchantReference });
    if ("websiteOrderRef" in result && result.websiteOrderRef) return NextResponse.redirect(new URL(`/order-success?ref=${encodeURIComponent(result.websiteOrderRef)}&pesapal=${result.completed ? "paid" : "pending"}`, url.origin));
    if (result.receiptToken) return NextResponse.redirect(new URL(`/r/${encodeURIComponent(result.receiptToken)}/view?pesapal=${result.completed ? "paid" : "pending"}`, url.origin));
  } catch { /* The IPN remains authoritative and will retry independently. */ }
  return NextResponse.redirect(new URL("/", url.origin));
}
