import { NextRequest, NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { findOrCreateCustomerIdentityUser } from "@/lib/customerIdentity";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";
import { DATA_LOGGER_DAILY_RATE, getStandardSiteVisitFee } from "@/lib/siteVisitPolicy";
import {
  createSiteVisit,
  listAdminSiteVisits,
  siteVisitCreateSchema,
} from "@/lib/siteVisits";

export const dynamic = "force-dynamic";

async function getStaffActor(request: NextRequest) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return { guard, actor: null };

  const actor = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!actor?.isActive) return { guard, actor: null };
  return { guard, actor };
}

export async function GET(request: NextRequest) {
  const { guard, actor } = await getStaffActor(request);
  if (!guard.ok) return guard.res;
  if (!actor) return NextResponse.json({ ok: false, error: "Staff account not found." }, { status: 403 });

  const visits = await listAdminSiteVisits({ assignedUserId: actor.id });
  return NextResponse.json({
    ok: true,
    actor: { id: actor.id, name: actor.name || actor.email || "Staff" },
    canWaive: guard.role === "ADMIN" || guard.role === "SUPERVISOR",
    visits: visits.slice(0, 12),
  });
}

export async function POST(request: NextRequest) {
  const { guard, actor } = await getStaffActor(request);
  if (!guard.ok) return guard.res;
  if (!actor) return NextResponse.json({ ok: false, error: "Staff account not found." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = siteVisitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Check the site visit details.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const customerPhone = normalizeKenyanPhone(input.customerPhone);
  if (!customerPhone) {
    return NextResponse.json({ ok: false, error: "Enter a valid Kenyan customer phone number." }, { status: 400 });
  }
  if (!input.county || !input.town || !input.location) {
    return NextResponse.json({ ok: false, error: "County, town and exact site location are required." }, { status: 400 });
  }
  if (!input.preferredDate) {
    return NextResponse.json({ ok: false, error: "Select the customer's preferred visit date." }, { status: 400 });
  }
  const visitFee = getStandardSiteVisitFee(input.county, input.town);
  if (visitFee == null) {
    return NextResponse.json({ ok: false, error: "Select a recognized county and town to calculate the visit fee." }, { status: 400 });
  }
  if (input.paymentStatus === "PAID" && (!input.paymentMethod?.trim() || !input.paymentReference?.trim())) {
    return NextResponse.json({ ok: false, error: "Paid bookings require a payment method and reference." }, { status: 400 });
  }
  if (input.paymentStatus === "WAIVED" && guard.role !== "ADMIN" && guard.role !== "SUPERVISOR") {
    return NextResponse.json({ ok: false, error: "Only management can waive a site visit payment." }, { status: 403 });
  }

  let assignedTechnicianId: string | undefined;
  if (input.assignedTechnicianId?.trim()) {
    const technician = await prisma.user.findUnique({
      where: { id: input.assignedTechnicianId.trim() },
      select: { id: true, isActive: true, attendantCategory: true },
    });
    if (!technician?.isActive || !isTechnicalTeamCategory(technician.attendantCategory)) {
      return NextResponse.json({ ok: false, error: "Select an active technical team member." }, { status: 400 });
    }
    assignedTechnicianId = technician.id;
  }

  const loggerDays = input.dataLoggerRequested ? Math.max(1, Math.min(3, Number(input.dataLoggerDays || 1))) : undefined;
  const loggerFee = input.dataLoggerRequested ? Number(loggerDays) * DATA_LOGGER_DAILY_RATE : 0;
  const totalPayable = visitFee + loggerFee;

  try {
    const customerIdentity = await findOrCreateCustomerIdentityUser({
      customerName: input.customerName,
      customerPhone,
      customerEmail: input.customerEmail || null,
      county: input.county,
      town: input.town,
      estateLandmark: input.landmark || null,
      locationNotes: input.location,
    });
    const visit = await createSiteVisit(
      {
        ...input,
        customerPhone,
        customerEmail: input.customerEmail || undefined,
        assignedStaffId: actor.id,
        assignedTechnicianId,
        visitFee,
        source: "STAFF",
        dataLoggerDays: loggerDays,
        paymentAmount: input.paymentStatus === "PAID" ? totalPayable : undefined,
        paymentMethod: input.paymentStatus === "PAID" ? input.paymentMethod : undefined,
        paymentReference: input.paymentStatus === "PAID" ? input.paymentReference : undefined,
        feeOverrideReason: undefined,
        waiverReason: input.paymentStatus === "WAIVED" ? input.waiverReason : undefined,
      },
      {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        customerUserId: customerIdentity.user.id,
      },
    );
    if (!visit) return NextResponse.json({ ok: false, error: "Unable to create site visit." }, { status: 500 });

    void notifySiteVisitCustomer({
      event: "REQUEST_RECEIVED",
      customerName: visit.customerName,
      phone: visit.customerPhone,
      email: visit.customerEmail,
      visitRef: visit.visitRef,
      detail: `${visit.assignedStaffName || actor.name || "Betech staff"} is your contact. Total payable: KES ${visit.totalPayable.toLocaleString("en-KE")}.`,
    });
    await notifyAdminCriticalSms({
      eventType: "SITE_VISIT_REQUESTED",
      entityId: visit.id,
      title: `Staff site visit booking ${visit.visitRef}`,
      details: [
        `Customer: ${visit.customerName}`,
        `Owner: ${visit.assignedStaffName || actor.name || actor.email || "Staff"}`,
        `Technician: ${visit.assignedTechnicianName || "Awaiting assignment"}`,
        `Location: ${visit.town}, ${visit.county}`,
        `Payment: ${visit.paymentStatus} · KSh ${visit.totalPayable.toLocaleString("en-KE")}`,
        visit.dataLoggerRequested ? `Data logger: ${visit.dataLoggerDays} day(s)` : "Data logger: Not requested",
      ],
      actionPath: `/admin/quotation-center/site-visits/${encodeURIComponent(visit.id)}`,
      payload: { visitRef: visit.visitRef, ownerId: actor.id, technicianId: assignedTechnicianId || null },
    });

    return NextResponse.json({ ok: true, visit }, { status: 201 });
  } catch (error) {
    console.error("[receipts.site-visits] POST failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create site visit." },
      { status: 500 },
    );
  }
}
