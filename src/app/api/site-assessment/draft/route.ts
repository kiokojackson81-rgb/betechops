import { NextResponse } from "next/server";
import {
  clearSiteAssessmentDraft,
  getSiteAssessmentDraft,
  getSiteVisitById,
  saveSiteAssessmentDraft,
} from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const MAX_DRAFT_BYTES = 150_000;

export async function POST(request: Request) {
  let body: { token?: unknown; action?: unknown; draft?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid draft request." }, { status: 400 });
  }

  const token = String(body.token || "");
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload) {
    return NextResponse.json({ ok: false, error: "This assessment link is invalid or has expired." }, { status: 403 });
  }
  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId) {
    return NextResponse.json({ ok: false, error: "This assessment is no longer assigned to this link." }, { status: 403 });
  }

  const action = String(body.action || "load");
  if (action === "load") {
    const stored = await getSiteAssessmentDraft(visit.id);
    return NextResponse.json({ ok: true, draft: stored?.draft || null, savedAt: stored?.savedAt || null });
  }
  if (visit.status === "CANCELLED" || visit.assessmentReport) {
    return NextResponse.json({ ok: false, error: "This assessment can no longer be edited." }, { status: 409 });
  }
  if (action === "clear") {
    await clearSiteAssessmentDraft(visit.id, tokenPayload.technicianId);
    return NextResponse.json({ ok: true });
  }
  if (action !== "save" || !body.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) {
    return NextResponse.json({ ok: false, error: "Assessment draft details are invalid." }, { status: 400 });
  }

  const encoded = JSON.stringify(body.draft);
  if (encoded.length > MAX_DRAFT_BYTES) {
    return NextResponse.json({ ok: false, error: "Assessment draft is too large to save." }, { status: 413 });
  }
  const savedAt = await saveSiteAssessmentDraft(
    visit.id,
    body.draft as Prisma.JsonObject,
    tokenPayload.technicianId,
  );
  if (!savedAt) {
    return NextResponse.json({ ok: false, error: "This assessment can no longer be edited." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, savedAt });
}
