import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { getSiteVisitById } from "@/lib/siteVisits";
import { dispatchSiteVisitCreated } from "@/lib/siteVisitNotifications";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth().catch(() => null);
  const actor = await getSiteVisitAccessActor(session?.user as never);
  if (!actor?.canManageCommercials) return NextResponse.json({ ok: false, error: "Only an administrator or supervisor can send a customer SMS." }, { status: 403 });
  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit) return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  const notification = await dispatchSiteVisitCreated(visit, actor.name || actor.email || "Admin", { resend: true });
  if (notification.status !== "SENT") return NextResponse.json({ ok: false, notification, error: "The customer SMS could not be sent. Check the phone number and SMS provider." }, { status: 502 });
  return NextResponse.json({ ok: true, notification });
}
