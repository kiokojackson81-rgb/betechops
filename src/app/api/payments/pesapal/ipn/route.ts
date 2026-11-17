import { NextRequest, NextResponse } from "next/server";
import { settlePesapalPayment } from "@/lib/pesapal";

export const dynamic = "force-dynamic";

async function inputFrom(request: NextRequest) {
  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  return {
    trackingId: String(body.OrderTrackingId || body.order_tracking_id || url.searchParams.get("OrderTrackingId") || ""),
    merchantReference: String(body.OrderMerchantReference || body.order_merchant_reference || url.searchParams.get("OrderMerchantReference") || ""),
  };
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
async function handle(request: NextRequest) {
  const input = await inputFrom(request);
  if (!input.trackingId || !input.merchantReference) return NextResponse.json({ error: "Missing Pesapal notification details." }, { status: 400 });
  try {
    const result = await settlePesapalPayment(input);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process Pesapal notification." }, { status: 400 });
  }
}
