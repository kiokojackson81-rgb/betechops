import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { createSiteVisitAttachment, getSiteVisitById } from "@/lib/siteVisits";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { isAllowedSiteVisitAttachment } from "@/lib/siteVisitPolicy";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null; attendantCategory?: string | null } | undefined;
  const actor = await getSiteVisitAccessActor(user);
  if (!session || !actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "Blob storage is not configured." }, { status: 500 });
  }

  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit) {
    return NextResponse.json({ ok: false, error: "Site visit not found." }, { status: 404 });
  }
  if (!canAccessSiteVisit(actor, visit)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attachment file is required." }, { status: 400 });
  }
  const fileError = isAllowedSiteVisitAttachment(file);
  if (fileError) return NextResponse.json({ ok: false, error: fileError }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const arrayBuffer = await file.arrayBuffer();
  const blob = await put(`site-visits/${id}/${Date.now()}-${safeName}`, Buffer.from(arrayBuffer), {
    access: "public",
    contentType: file.type || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const attachment = await createSiteVisitAttachment({
    siteVisitId: id,
    fileName: file.name,
    fileUrl: blob.url,
    fileKey: blob.pathname,
    contentType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
  }, {
    id: actor.id,
    name: actor.name,
    email: actor.email,
  });

  if (!attachment) {
    return NextResponse.json({ ok: false, error: "Failed to save attachment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, attachment, visit });
}
