import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import {
  createSiteVisit,
  listAdminSiteVisits,
  siteVisitCreateSchema,
  type SiteVisitStatus,
} from "@/lib/siteVisits";

export const dynamic = "force-dynamic";

function canAccessSiteVisits(user: { role?: string | null; attendantCategory?: string | null } | null | undefined) {
  return user?.role === "ADMIN" || user?.role === "SUPERVISOR" || isTechnicalTeamCategory(user?.attendantCategory);
}

export async function GET(request: NextRequest) {
  const session = await auth().catch(() => null);
  const user = session?.user as { role?: string; attendantCategory?: string | null } | undefined;
  if (!session || !canAccessSiteVisits(user)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const status = (request.nextUrl.searchParams.get("status") || "ALL").trim().toUpperCase() as SiteVisitStatus | "ALL";
  const q = request.nextUrl.searchParams.get("q") || "";
  const visits = await listAdminSiteVisits({ status, q });
  return NextResponse.json({ ok: true, visits });
}

export async function POST(request: NextRequest) {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null; attendantCategory?: string | null } | undefined;
  if (!session || !canAccessSiteVisits(user)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = siteVisitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid site visit payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const visit = await createSiteVisit(parsed.data, {
    id: user?.id || "",
    name: user?.name || null,
    email: user?.email || null,
  });
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Unable to create site visit." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, visit });
}
