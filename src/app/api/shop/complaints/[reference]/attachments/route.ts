import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireComplaintCustomer } from "@/lib/complaintAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintCustomer();
  if (!access.ok) return access.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Attachment storage is not configured." }, { status: 503 });
  const { reference } = await context.params;
  const complaint = await prisma.complaint.findFirst({ where: { reference, customerId: access.userId }, select: { id: true, _count: { select: { attachments: true } } } });
  if (!complaint) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  if (complaint._count.attachments >= 5) return NextResponse.json({ error: "A complaint can have up to 5 attachments." }, { status: 400 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Upload an image, MP4/WebM video, PDF, or Word document." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Each attachment must be smaller than 10 MB." }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "attachment";
  const blob = await put(`complaints/${reference}/${randomUUID()}-${safeName}`, Buffer.from(await file.arrayBuffer()), { access: "public", contentType: file.type, token: process.env.BLOB_READ_WRITE_TOKEN });
  const attachment = await prisma.$transaction(async (tx) => {
    const created = await tx.complaintAttachment.create({ data: { complaintId: complaint.id, uploadedById: access.userId, fileName: file.name.slice(0, 180), fileUrl: blob.url, fileKey: blob.pathname, contentType: file.type, fileSize: file.size } });
    await tx.complaintActivity.create({ data: { complaintId: complaint.id, actorUserId: access.userId, actorType: "CUSTOMER", eventType: "ATTACHMENT_ADDED", summary: `Customer added attachment: ${file.name.slice(0, 120)}.` } });
    return created;
  });
  return NextResponse.json({ attachment }, { status: 201 });
}
