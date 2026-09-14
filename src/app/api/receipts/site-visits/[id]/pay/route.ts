import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAttendant } from "@/lib/auth";
import { initiateStkPushForResource } from "@/lib/mpesa";
import { getSiteVisitById } from "@/lib/siteVisits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  phoneNumber: z.string().trim().min(7).max(40).optional(),
});

/**
 * The public payment endpoint intentionally verifies customer ownership. This
 * desk-only endpoint lets a staff member trigger the very same STK/PayBill
 * procedure immediately after creating a booking for a customer.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a valid Kenyan M-Pesa number." }, { status: 400 });

  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit) return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  if (["CANCELLED", "COMPLETED", "CLOSED"].includes(visit.status)) {
    return NextResponse.json({ ok: false, error: "This site visit cannot accept a payment." }, { status: 409 });
  }
  if (["PAID", "WAIVED"].includes(visit.paymentStatus)) {
    return NextResponse.json({ ok: false, error: "The site visit fee is already settled." }, { status: 409 });
  }

  try {
    const payment = await initiateStkPushForResource({
      resourceType: "SITE_VISIT",
      reference: visit.visitRef,
      phoneNumber: parsed.data.phoneNumber || visit.customerPhone,
    });
    return NextResponse.json({ ok: true, ...payment }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the M-Pesa payment prompt.";
    return NextResponse.json({ ok: false, error: message }, { status: /number|amount|outstanding/i.test(message) ? 400 : 502 });
  }
}
