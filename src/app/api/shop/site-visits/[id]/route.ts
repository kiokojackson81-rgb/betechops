import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { customerOwnsSiteVisit, customerSiteVisitActionSchema, recordCustomerSiteVisitAction, toCustomerSiteVisit } from "@/lib/siteVisits";
import { notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth().catch(() => null);
    const user = session?.user as { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | undefined;
    if (!user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const identity = buildCustomerAccountIdentity({ id: user.id, phone: user.phone || null, email: user.email || null }, null);
    const { id } = await context.params;
    const visit = await customerOwnsSiteVisit({ visitId: id, ...identity });
    if (!visit) return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
    const parsed = customerSiteVisitActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid site visit request.", issues: parsed.error.flatten() }, { status: 400 });
    const updated = await recordCustomerSiteVisitAction(visit, parsed.data, { id: user.id, name: user.name || null, email: user.email || null });
    if (!updated) return NextResponse.json({ ok: false, error: "Unable to update site visit." }, { status: 500 });
    if (parsed.data.action === "SUBMIT_PAYMENT") void notifySiteVisitCustomer({ event: "PAYMENT_SUBMITTED", customerName: visit.customerName, phone: visit.customerPhone, email: visit.customerEmail, visitRef: visit.visitRef, detail: "Our team will verify the payment before confirming the visit." });
    return NextResponse.json({ ok: true, visit: toCustomerSiteVisit(updated) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update site visit." }, { status: 400 });
  }
}
