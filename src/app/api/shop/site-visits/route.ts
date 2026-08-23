import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { customerSiteVisitCreateSchema, createSiteVisit, listCustomerSiteVisits, toCustomerSiteVisit } from "@/lib/siteVisits";
import { getStandardSiteVisitFee } from "@/lib/siteVisitPolicy";
import { notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";

export async function GET() {
  try {
    const session = await auth().catch(() => null);
    const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
    if (!user?.id) {
      return NextResponse.json({ ok: true, siteVisits: [] });
    }

    const identity = buildCustomerAccountIdentity(
      {
        id: user.id,
        phone: user.phone || null,
        email: user.email || null,
      },
      null,
    );

    const siteVisits = await listCustomerSiteVisits({
      userId: identity.userId,
      phoneVariants: identity.phoneVariants,
      normalizedEmails: identity.normalizedEmails,
      take: 10,
    });

    return NextResponse.json({ ok: true, siteVisits: siteVisits.map(toCustomerSiteVisit) });
  } catch (error) {
    console.error("[shop.site-visits] GET failed", error);
    return NextResponse.json({ ok: false, error: "Unable to load site visits right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth().catch(() => null);
    const sessionUser = session?.user as { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | undefined;
    if (!sessionUser?.id) return NextResponse.json({ ok: false, error: "Please sign in to request a site visit." }, { status: 401 });
    const body = await request.json().catch(() => null);
    const parsed = customerSiteVisitCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Please complete all required booking details.", issues: parsed.error.flatten() }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { name: true, phone: true, email: true } });
    const customerName = user?.name || sessionUser.name || "Betech Customer";
    const customerPhone = user?.phone || sessionUser.phone || "";
    if (!customerPhone) return NextResponse.json({ ok: false, error: "Add a phone number to your profile before booking." }, { status: 400 });
    const visitFee = getStandardSiteVisitFee(parsed.data.county);
    if (!visitFee) return NextResponse.json({ ok: false, error: "Select a valid county to calculate the site visit fee." }, { status: 400 });
    const visit = await createSiteVisit({
      ...parsed.data,
      customerName,
      customerPhone,
      customerEmail: user?.email || sessionUser.email || "",
      visitFee,
      source: "CUSTOMER_REQUEST",
      paymentStatus: "UNPAID",
    }, {
      id: sessionUser.id,
      customerUserId: sessionUser.id,
      name: customerName,
      email: user?.email || sessionUser.email || null,
    });
    if (!visit) return NextResponse.json({ ok: false, error: "Unable to create the site visit request." }, { status: 500 });
    void notifySiteVisitCustomer({ event: "REQUEST_RECEIVED", customerName, phone: customerPhone, email: visit.customerEmail, visitRef: visit.visitRef, detail: `Fee KES ${visitFee.toLocaleString("en-KE")} is awaiting payment verification.` });
    return NextResponse.json({ ok: true, visit: toCustomerSiteVisit(visit) }, { status: 201 });
  } catch (error) {
    console.error("[shop.site-visits] POST failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to request a site visit." }, { status: 500 });
  }
}
