import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createSiteVisitAttachment, getSiteVisitById, publishSiteAssessmentReport } from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { siteAssessmentReportSchema, type SiteAssessmentReport } from "@/lib/siteAssessmentReport";
import { dispatchSiteAssessmentReportPublished } from "@/lib/siteVisitNotifications";

export const runtime = "nodejs";

const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload) return NextResponse.json({ ok: false, error: "This assessment link is invalid or has expired." }, { status: 403 });
  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId) {
    return NextResponse.json({ ok: false, error: "This assessment is no longer assigned to this link." }, { status: 403 });
  }
  if (visit.assessmentReport) {
    return NextResponse.json({ ok: false, error: "This site assessment report has already been published." }, { status: 409 });
  }

  const rawReport = String(form.get("report") || "");
  if (!rawReport || rawReport.length > 100_000) {
    return NextResponse.json({ ok: false, error: "Assessment report details are missing or too large." }, { status: 400 });
  }
  let parsedReport: unknown;
  try {
    parsedReport = JSON.parse(rawReport);
  } catch {
    return NextResponse.json({ ok: false, error: "Assessment report details are invalid." }, { status: 400 });
  }
  const validation = siteAssessmentReportSchema.safeParse(parsedReport);
  if (!validation.success || !validation.data.signatures) {
    return NextResponse.json({ ok: false, error: "Complete the final customer and technician electronic sign-off before sharing the report." }, { status: 400 });
  }
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File).slice(0, MAX_PHOTOS);
  if (photos.some((file) => !file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES)) {
    return NextResponse.json({ ok: false, error: "Evidence photos must be images smaller than 5 MB." }, { status: 400 });
  }

  const actor = {
    id: tokenPayload.technicianId,
    name: visit.assignedTechnicianName || "Betech Technician",
    email: null,
  };
  const report: SiteAssessmentReport = {
    ...validation.data,
    signatures: {
      ...validation.data.signatures,
      // The signed link is bound to the assigned technician. Record that
      // verified Betech identity rather than trusting a browser-entered name.
      technicianName: actor.name,
    },
    version: 1,
    submittedAt: new Date().toISOString(),
    submittedByName: actor.name,
  };
  const published = await publishSiteAssessmentReport(visit.id, report, actor);
  if (!published) {
    return NextResponse.json({ ok: false, error: "This site assessment report has already been published." }, { status: 409 });
  }

  const attachmentFailures: string[] = [];
  if (photos.length && process.env.BLOB_READ_WRITE_TOKEN) {
    await Promise.all(
      photos.map(async (photo) => {
        try {
          const safeName = photo.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "site-evidence.jpg";
          const blob = await put(
            `site-visits/${visit.id}/assessment/${Date.now()}-${safeName}`,
            Buffer.from(await photo.arrayBuffer()),
            { access: "public", contentType: photo.type, token: process.env.BLOB_READ_WRITE_TOKEN },
          );
          await createSiteVisitAttachment({
            siteVisitId: visit.id,
            fileName: `Assessment evidence — ${photo.name}`,
            fileUrl: blob.url,
            fileKey: blob.pathname,
            contentType: photo.type,
            fileSizeBytes: photo.size,
          }, actor);
        } catch (error) {
          attachmentFailures.push(error instanceof Error ? error.message : "Evidence upload failed.");
        }
      }),
    );
  } else if (photos.length) {
    attachmentFailures.push("Evidence could not be uploaded because blob storage is not configured.");
  }

  const notification = await dispatchSiteAssessmentReportPublished(published, report);
  return NextResponse.json({
    ok: true,
    visit: published,
    notification,
    attachmentFailures,
  });
}
