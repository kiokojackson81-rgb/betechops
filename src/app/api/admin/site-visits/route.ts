import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import {
  createSiteVisit,
  listAdminSiteVisits,
  siteVisitCreateSchema,
  type SiteVisitStatus,
} from "@/lib/siteVisits";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth().catch(() => null);
  const user = session?.user as { role?: string; attendantCategory?: string | null } | undefined;
  const actor = await getSiteVisitAccessActor(user);
  if (!session || !actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const status = (request.nextUrl.searchParams.get("status") || "ALL").trim().toUpperCase() as SiteVisitStatus | "ALL";
  const q = request.nextUrl.searchParams.get("q") || "";
  const visits = await listAdminSiteVisits({ status, q, assignedUserId: actor.canViewAll ? null : actor.id });
  return NextResponse.json({ ok: true, visits });
}

export async function POST(request: NextRequest) {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null; attendantCategory?: string | null } | undefined;
  const actor = await getSiteVisitAccessActor(user);
  if (!session || !actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = siteVisitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid site visit payload.", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!actor.canViewAll) {
    return NextResponse.json({ ok: false, error: "Only administrators, supervisors and technical managers can create site visits." }, { status: 403 });
  }

  const visit = await createSiteVisit(parsed.data, {
    id: actor.id,
    name: actor.name,
    email: actor.email,
  });
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Unable to create site visit." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, visit });
}
