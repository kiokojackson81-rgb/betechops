import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import {
  getSiteVisitById,
  listSiteVisitAttachments,
  listSiteVisitEvents,
  siteVisitUpdateSchema,
  updateSiteVisit,
} from "@/lib/siteVisits";
import { dispatchSiteVisitTechnicianAssignment, notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null; attendantCategory?: string | null } | undefined;
  const actor = await getSiteVisitAccessActor(user);
  if (!session || !actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  }
  if (!canAccessSiteVisit(actor, visit)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [events, attachments] = await Promise.all([
    listSiteVisitEvents(id),
    listSiteVisitAttachments(id),
  ]);

  return NextResponse.json({ ok: true, visit, events, attachments });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null; attendantCategory?: string | null } | undefined;
  const actor = await getSiteVisitAccessActor(user);
  if (!session || !actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSiteVisitById(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  if (!canAccessSiteVisit(actor, existing)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = siteVisitUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid site visit update payload.", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!actor.canManageCommercials) {
    const commercialChanged =
      (parsed.data.visitFee !== undefined && Number(parsed.data.visitFee) !== existing.visitFee) ||
      (parsed.data.paymentStatus !== undefined && parsed.data.paymentStatus !== existing.paymentStatus) ||
      (parsed.data.paymentReference !== undefined && parsed.data.paymentReference !== existing.paymentReference) ||
      parsed.data.feeOverrideReason !== undefined || parsed.data.waiverReason !== undefined;
    if (commercialChanged) return NextResponse.json({ ok: false, error: "Only administrators or supervisors can change visit fees and payments." }, { status: 403 });
  }
  const assignmentChanged =
    (parsed.data.assignedStaffId !== undefined && (parsed.data.assignedStaffId || null) !== existing.assignedStaffId) ||
    (parsed.data.assignedTechnicianId !== undefined && (parsed.data.assignedTechnicianId || null) !== existing.assignedTechnicianId);
  if (assignmentChanged && !actor.canAssignTechnicians) {
    return NextResponse.json({ ok: false, error: "Only an administrator can assign the visit owner or technician." }, { status: 403 });
  }
  if (parsed.data.assignedTechnicianId?.startsWith("external:")) {
    const externalId = parsed.data.assignedTechnicianId.slice("external:".length);
    const external = await (await import("@/lib/prisma")).prisma.projectExternalAgent.findFirst({ where: { id: externalId, isActive: true }, select: { id: true } });
    if (!external) return NextResponse.json({ ok: false, error: "Select an active external technician." }, { status: 400 });
  }

  const visit = await updateSiteVisit(id, parsed.data, {
    id: actor.id,
    name: actor.name,
    email: actor.email,
  });
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  }

  if (existing.paymentStatus !== "PAID" && visit.paymentStatus === "PAID") {
    void notifySiteVisitCustomer({
      event: "PAYMENT_CONFIRMED",
      customerName: visit.customerName,
      phone: visit.customerPhone,
      email: visit.customerEmail,
      visitRef: visit.visitRef,
      detail: `KES ${visit.visitFee.toLocaleString("en-KE")} confirmed.`,
    });
  }
  const technicianChanged = existing.assignedTechnicianId !== visit.assignedTechnicianId;
  if (technicianChanged && visit.assignedTechnicianId) void dispatchSiteVisitTechnicianAssignment(visit, existing.assignedTechnicianId);

  return NextResponse.json({ ok: true, visit });
}
