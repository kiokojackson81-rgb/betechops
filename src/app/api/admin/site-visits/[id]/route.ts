import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSiteVisitById,
  listSiteVisitAttachments,
  listSiteVisitEvents,
  siteVisitUpdateSchema,
  updateSiteVisit,
} from "@/lib/siteVisits";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | null | undefined) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth().catch(() => null);
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session || !isAdminRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  }

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
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null } | undefined;
  if (!session || !isAdminRole(user?.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = siteVisitUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid site visit update payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const visit = await updateSiteVisit(id, parsed.data, {
    id: user?.id || "",
    name: user?.name || null,
    email: user?.email || null,
  });
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, visit });
}
