import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { customerSiteVisitCreateSchema, createSiteVisit, listCustomerSiteVisits, toCustomerSiteVisit } from "@/lib/siteVisits";
import { getStandardSiteVisitFee } from "@/lib/siteVisitPolicy";
import { notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";
import { getShopProductBySlugOrOpsProductId } from "@/app/shop/shopApi";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import { isProductLinkedSiteVisitEligible } from "@/lib/siteVisitPolicy";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";

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
    const visitFee = getStandardSiteVisitFee(parsed.data.county, parsed.data.town);
    if (!visitFee) return NextResponse.json({ ok: false, error: "Select a recognized county and town to calculate the site visit fee." }, { status: 400 });
    const requestedProductId = parsed.data.originProductId?.trim() || "";
    const requestedProductSlug = parsed.data.originProductSlug?.trim() || "";
    const product = requestedProductId || requestedProductSlug
      ? await getShopProductBySlugOrOpsProductId(requestedProductSlug, requestedProductId)
      : null;
    if ((requestedProductId || requestedProductSlug) && !product) {
      return NextResponse.json({ ok: false, error: "The selected catalogue product is no longer available." }, { status: 400 });
    }
    if (product && !isProductLinkedSiteVisitEligible(product.price)) {
      return NextResponse.json({ ok: false, error: "Product-linked Site Visits are available for products above KES 100,000." }, { status: 400 });
    }
    const dataLoggerRequested = Boolean(parsed.data.dataLoggerRequested);
    const dataLoggerDays = dataLoggerRequested ? Math.max(1, Math.min(3, Number(parsed.data.dataLoggerDays || 1))) : undefined;
    const visit = await createSiteVisit({
      ...parsed.data,
      customerName,
      customerPhone,
      customerEmail: user?.email || sessionUser.email || "",
      visitFee,
      originProductId: product ? (product.opsProductId || product.id) : undefined,
      originProductName: product?.name,
      originProductSlug: product?.slug,
      originProductPrice: product?.price,
      originProductCategory: product?.category,
      originProductImage: product?.image,
      originProductUrl: product ? getShopProductHref(product.slug, product.opsProductId) : undefined,
      dataLoggerRequested,
      dataLoggerDays,
      source: "CUSTOMER_REQUEST",
      paymentStatus: "UNPAID",
    }, {
      id: sessionUser.id,
      customerUserId: sessionUser.id,
      name: customerName,
      email: user?.email || sessionUser.email || null,
    });
    if (!visit) return NextResponse.json({ ok: false, error: "Unable to create the site visit request." }, { status: 500 });
    void notifySiteVisitCustomer({ event: "REQUEST_RECEIVED", customerName, phone: customerPhone, email: visit.customerEmail, visitRef: visit.visitRef, detail: `Total KES ${visit.totalPayable.toLocaleString("en-KE")} is awaiting payment verification.` });
    await notifyAdminCriticalSms({
      eventType: "SITE_VISIT_REQUESTED",
      entityId: visit.id,
      title: `New site visit request ${visit.visitRef}`,
      details: [
        `Customer: ${customerName}`,
        `Location: ${parsed.data.town}, ${parsed.data.county}`,
        `Fee: KSh ${visit.totalPayable.toLocaleString("en-KE")}`,
        `Product: ${product?.name || "General assessment"}`,
        `Preferred date: ${parsed.data.preferredDate || "Not specified"}`,
      ],
      actionPath: `/admin/quotation-center/site-visits/${encodeURIComponent(visit.id)}`,
      payload: { visitRef: visit.visitRef, paymentStatus: visit.paymentStatus },
    });
    return NextResponse.json({ ok: true, visit: toCustomerSiteVisit(visit) }, { status: 201 });
  } catch (error) {
    console.error("[shop.site-visits] POST failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to request a site visit." }, { status: 500 });
  }
}
