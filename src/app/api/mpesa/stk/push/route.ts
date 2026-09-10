import { NextResponse } from "next/server";
import { z } from "zod";
import { initiateStkPush } from "@/lib/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  // The browser may identify an order and provide its own phone number, but it
  // never supplies a charge amount. The server reads that from the order.
  orderReference: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(30).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid order reference is required." }, { status: 400 });

  try {
    const result = await initiateStkPush(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initiate the M-Pesa payment.";
    const status = /not found/i.test(message) ? 404 : /number|amount|due/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
